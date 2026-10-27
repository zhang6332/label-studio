"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
"""Aliyun Object Storage Service (OSS) storages.

zjh: OSS endpoints reject AWS-style signatures (SigV2/SigV4) outright with a
generic 403 Forbidden — only the Aliyun-native signature scheme is accepted.
The boto3/S3 inheritance therefore cannot be used for any wire call, so this
module implements the storage surface on the official ``oss2`` SDK (native
signing) while keeping the S3 model fields, sync machinery and DB schema.

Configured via the same fields as before:

  * ``s3_endpoint``           e.g. ``https://oss-cn-hangzhou.aliyuncs.com``
  * ``region_name``           optional; e.g. ``oss-cn-hangzhou`` (fallback to build an endpoint)
  * ``aws_access_key_id``     Aliyun AccessKey ID
  * ``aws_secret_access_key`` Aliyun AccessKey Secret
"""
import json
import logging
import re
from types import SimpleNamespace
from urllib.parse import urlparse

import oss2

from core.redis import start_job_async_or_sync
from django.conf import settings
from django.db import models
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from io_storages.base_models import (
    ExportStorage,
    ExportStorageLink,
    ImportStorageLink,
    ProjectStorageMixin,
)
from io_storages.s3.models import S3ImportStorageBase, S3StorageMixin
from io_storages.s3.utils import catch_and_reraise_from_none
from io_storages.utils import StorageObject, is_collection_submission_key, load_tasks_json
from tasks.models import Annotation

logger = logging.getLogger(__name__)


class _OssStreamAdapter:
    """Adapts oss2's GetObjectResult to the botocore StreamingBody surface
    (``iter_chunks``) consumed by the storage proxy API."""

    def __init__(self, result):
        self._result = result

    def iter_chunks(self, chunk_size=64 * 1024):
        while True:
            chunk = self._result.read(chunk_size)
            if not chunk:
                return
            yield chunk

    def read(self, amt=None):
        return self._result.read(amt)

    def close(self):
        self._result.close()


class OssClientMixin:
    """Aliyun-native client access via the oss2 SDK (native signing).

    Shared by import and export storages; overrides every boto3 touchpoint
    inherited from the S3 bases (validate/scan/presign/read/write/delete).
    """

    def _oss_client(self) -> oss2.Bucket:
        endpoint = self.s3_endpoint or (
            f'https://{self.region_name}.aliyuncs.com' if self.region_name else None
        )
        if not endpoint:
            raise ValueError('OSS storage requires an endpoint URL (or a region like oss-cn-beijing)')
        auth = oss2.Auth(self.aws_access_key_id, self.aws_secret_access_key)
        return oss2.Bucket(auth, endpoint, self.bucket)

    def get_client(self):
        raise NotImplementedError('OSS storage uses oss2 native signing; use _oss_client()')

    def get_client_and_resource(self):
        raise NotImplementedError('OSS storage uses oss2 native signing; use _oss_client()')

    def get_client_and_bucket(self, validate_connection=True):
        raise NotImplementedError('OSS storage uses oss2 native signing; use _oss_client()')

    def get_blob_metadata(self, key):
        # S3-style metadata dict for parity with the boto3 implementation.
        res = self._oss_client().head_object(key)
        return {
            'ETag': res.etag,
            'ContentLength': res.content_length,
            'ContentType': res.headers.get('Content-Type'),
            'LastModified': res.headers.get('Last-Modified'),
        }

    def generate_http_url(self, url):
        # Shared by import (per-connection presign flag) and export (settings-level).
        key = urlparse(url, allow_fragments=False).path.lstrip('/')
        if getattr(self, 'presign', True):
            return self._oss_client().sign_url('GET', key, self.presign_ttl * 60, slash_safe=True)
        res = self._oss_client().get_object(key)
        content_type = res.headers.get('Content-Type', 'application/octet-stream')
        import base64

        return 'data:' + content_type + ';base64,' + base64.b64encode(res.read()).decode('utf-8')

    def _normalized_prefix(self) -> str:
        # OSS object keys never start with '/'; users habitually type a leading
        # slash, which would silently list nothing. Normalize for them.
        prefix = (self.prefix or '').lstrip('/').rstrip('/')
        return prefix + '/' if prefix else ''

    def validate_connection(self, client=None):
        """Probe the bucket with ListObjects (max_keys=1) — the operation RAM
        users granting object-read access reliably have (GetBucketInfo, used by
        the S3 head_bucket probe, is frequently not granted)."""
        logger.debug('validate_connection (oss2 native)')
        client = client or self._oss_client()
        prefix = self._normalized_prefix()
        client.list_objects(prefix=prefix, max_keys=1)
        logger.debug(f'[Class {self.__class__.__name__}]: OSS connection OK for bucket {self.bucket}')

    def get_bytes_stream(self, uri, range_header=None):
        """oss2 equivalent of the S3 direct stream, used by the storage proxy
        API. Range forwarding keeps audio/video seeking working in proxy mode
        (presign off). Returns (stream, content_type, metadata) or (None, None, {})."""
        key = urlparse(uri, allow_fragments=False).path.lstrip('/')
        try:
            client = self._oss_client()
            headers = {'Range': range_header} if range_header else None
            res = client.get_object(key, headers=headers)
            metadata = {
                'ETag': res.etag,
                'ContentLength': res.content_length,
                'ContentRange': res.content_range,
                'LastModified': res.headers.get('Last-Modified'),
                'StatusCode': res.status,
            }
            return _OssStreamAdapter(res), res.headers.get('Content-Type'), metadata
        except oss2.exceptions.NotFound:
            return None, None, {}
        except Exception as e:
            logger.error(f'Error getting direct stream from OSS for uri {uri}: {e}', exc_info=True)
            return None, None, {}


class OssImportStorageBase(OssClientMixin, S3ImportStorageBase):
    """OSS import storage.

    The S3 base still provides the model fields, sync bookkeeping and scan
    pipeline; every wire call is overridden below to go through oss2.
    """

    url_scheme = 'oss'

    @property
    def type_full(self):
        return 'Aliyun OSS'

    @catch_and_reraise_from_none
    def iter_objects(self):
        client = self._oss_client()
        prefix = self._normalized_prefix()
        delimiter = None if self.recursive_scan else '/'
        regex = re.compile(str(self.regex_filter)) if self.regex_filter else None

        marker = ''
        while True:
            res = client.list_objects(prefix=prefix, delimiter=delimiter, marker=marker, max_keys=1000)
            for obj in res.object_list:
                key = obj.key
                if key.endswith('/'):
                    logger.debug(key + ' is skipped because it is a folder')
                    continue
                if is_collection_submission_key(key):
                    logger.debug(key + ' is skipped: reserved collection submission object')
                    continue
                if regex and not regex.match(key):
                    logger.debug(key + ' is skipped by regex filter')
                    continue
                logger.debug(f'oss {key} has passed the regex filter')
                # Consumers: the scan pipeline reads `.key`; the files-preview API
                # reads `.key/.last_modified/.size` via get_unified_metadata.
                yield SimpleNamespace(key=key, last_modified=obj.last_modified, size=obj.size)
            if res.is_truncated:
                marker = res.next_marker
            else:
                return

    @catch_and_reraise_from_none
    def get_data(self, key) -> list[StorageObject]:
        uri = f'{self.url_scheme}://{self.bucket}/{key}'
        if self.use_blob_urls:
            data_key = settings.DATA_UNDEFINED_NAME
            task = {data_key: uri}
            return [StorageObject(key=key, task_data=task)]

        # read task json from bucket and validate it
        content = self._oss_client().get_object(key).read()
        return load_tasks_json(content, key)

    @catch_and_reraise_from_none
    def scan_and_create_links(self):
        return self._scan_and_create_links(OssImportStorageLink)

    class Meta:
        abstract = True


class OssImportStorage(ProjectStorageMixin, OssImportStorageBase):
    class Meta:
        abstract = False


class OssExportStorage(OssClientMixin, S3StorageMixin, ExportStorage):
    url_scheme = 'oss'

    # Read-back support (Data Collection): proxy_api checks hasattr(storage, 'presign')
    # to decide preview availability. Mirrors S3ExportStorage's settings-level attrs.
    presign = settings.EXPORT_STORAGE_PRESIGN
    presign_ttl = settings.EXPORT_STORAGE_PRESIGN_TTL_MINUTES

    @property
    def type_full(self):
        return 'Aliyun OSS'

    @catch_and_reraise_from_none
    def save_annotation(self, annotation):
        client = self._oss_client()
        logger.debug(f'Creating new object on {self.__class__.__name__} Storage {self} for annotation {annotation}')
        ser_annotation = self._get_serialized_data(annotation)

        # key that identifies this object in storage
        key = OssExportStorageLink.get_key(annotation)
        key = str(self.prefix) + '/' + key if self.prefix else key

        # put object into storage
        client.put_object(key, json.dumps(ser_annotation).encode('utf-8'))

        # create link if everything ok
        OssExportStorageLink.create(annotation, self)

    @catch_and_reraise_from_none
    def delete_annotation(self, annotation):
        client = self._oss_client()
        logger.debug(f'Deleting object on {self.__class__.__name__} Storage {self} for annotation {annotation}')

        # get key that identifies this object in storage
        key = OssExportStorageLink.get_key(annotation)
        key = str(self.prefix) + '/' + key if self.prefix else key

        # delete object from storage
        client.delete_object(key)

        # delete link if everything ok
        OssExportStorageLink.objects.filter(storage=self, annotation=annotation).delete()


def async_export_annotation_to_oss_storages(annotation: 'Annotation | int'):
    if isinstance(annotation, int):
        try:
            annotation = Annotation.objects.get(pk=annotation)
        except Annotation.DoesNotExist:
            logger.info(f'Annotation {annotation} no longer exists, skipping OSS export')
            return

    project = annotation.project
    if hasattr(project, 'io_storages_ossexportstorages'):
        for storage in project.io_storages_ossexportstorages.all():
            logger.debug(f'Export {annotation} to OSS storage {storage}')
            storage.save_annotation(annotation)


@receiver(post_save, sender=Annotation)
def export_annotation_to_oss_storages(sender, instance, **kwargs):
    storages = getattr(instance.project, 'io_storages_ossexportstorages', None)
    if storages and storages.exists():  # avoid excess jobs in rq
        start_job_async_or_sync(async_export_annotation_to_oss_storages, instance.pk)


@receiver(pre_delete, sender=Annotation)
def delete_annotation_from_oss_storages(sender, instance, **kwargs):
    links = OssExportStorageLink.objects.filter(annotation=instance)
    for link in links:
        storage = link.storage
        if storage.can_delete_objects:
            logger.debug(f'Delete {instance} from OSS storage {storage}')  # nosec
            storage.delete_annotation(instance)


class OssImportStorageLink(ImportStorageLink):
    storage = models.ForeignKey(OssImportStorage, on_delete=models.CASCADE, related_name='links')


class OssExportStorageLink(ExportStorageLink):
    storage = models.ForeignKey(OssExportStorage, on_delete=models.CASCADE, related_name='links')
