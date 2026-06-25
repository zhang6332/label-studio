"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
"""Aliyun Object Storage Service (OSS) storages.

OSS is wire-compatible with the Amazon S3 API (SigV4), so this module reuses the
boto3-based S3 implementation (``S3StorageMixin`` / ``S3ImportStorageBase``) and
only specializes the URL scheme and display name. To point a storage at an OSS
bucket, configure:

  * ``s3_endpoint``           e.g. ``https://oss-cn-hangzhou.aliyuncs.com``
  * ``region_name``           e.g. ``oss-cn-hangzhou``
  * ``aws_access_key_id``     Aliyun AccessKey ID
  * ``aws_secret_access_key`` Aliyun AccessKey Secret
"""
import json
import logging

from core.redis import start_job_async_or_sync
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
from tasks.models import Annotation

logger = logging.getLogger(__name__)


class OssImportStorageBase(S3ImportStorageBase):
    """OSS import storage.

    Inherits all boto3 listing / reading / presigning logic from the S3
    implementation. Only the URL scheme, display name and the link model used
    for scan bookkeeping are specialized so OSS objects (``oss://...``) resolve
    through this storage instead of being mixed up with S3 ones.
    """

    url_scheme = 'oss'

    @property
    def type_full(self):
        return 'Aliyun OSS'

    @catch_and_reraise_from_none
    def scan_and_create_links(self):
        return self._scan_and_create_links(OssImportStorageLink)

    class Meta:
        abstract = True


class OssImportStorage(ProjectStorageMixin, OssImportStorageBase):
    class Meta:
        abstract = False


class OssExportStorage(S3StorageMixin, ExportStorage):
    url_scheme = 'oss'

    @property
    def type_full(self):
        return 'Aliyun OSS'

    @catch_and_reraise_from_none
    def save_annotation(self, annotation):
        _, s3 = self.get_client_and_resource()
        logger.debug(f'Creating new object on {self.__class__.__name__} Storage {self} for annotation {annotation}')
        ser_annotation = self._get_serialized_data(annotation)

        # key that identifies this object in storage
        key = OssExportStorageLink.get_key(annotation)
        key = str(self.prefix) + '/' + key if self.prefix else key

        # put object into storage
        s3.Object(self.bucket, key).put(Body=json.dumps(ser_annotation))

        # create link if everything ok
        OssExportStorageLink.create(annotation, self)

    @catch_and_reraise_from_none
    def delete_annotation(self, annotation):
        _, s3 = self.get_client_and_resource()
        logger.debug(f'Deleting object on {self.__class__.__name__} Storage {self} for annotation {annotation}')

        # get key that identifies this object in storage
        key = OssExportStorageLink.get_key(annotation)
        key = str(self.prefix) + '/' + key if self.prefix else key

        # delete object from storage
        s3.Object(self.bucket, key).delete()

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
