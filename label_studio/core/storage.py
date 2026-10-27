"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license."""

import logging
import os
import threading
from datetime import datetime, timezone as dt_timezone
from urllib.parse import unquote, urlsplit, urlunsplit

import google.auth
import oss2
from django.conf import settings
from django.contrib.staticfiles.storage import ManifestStaticFilesStorage
from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import File
from django.core.files.storage import Storage
from storages.backends.azure_storage import AzureStorage
from storages.backends.gcloud import GoogleCloudStorage, _quote, clean_name
from storages.backends.s3boto3 import S3Boto3Storage

from core.utils.params import get_env

logger = logging.getLogger(__name__)


class SkipMissedManifestStaticFilesStorage(ManifestStaticFilesStorage):
    """We need this class to escape missing files from
    django.contrib.staticfiles.finders.FileSystemFinder:
    this class tries to find js/css/png/jpg/... inside of you js/css/...
    """

    # Disable strict cache manifest checking
    manifest_strict = False

    def hashed_name(self, name, content=None, filename=None):
        # `filename` is the name of file to hash if `content` isn't given.
        # `name` is the base name to construct the new hashed filename from.
        parsed_name = urlsplit(unquote(name))
        clean_name = parsed_name.path.strip()
        filename = (filename and urlsplit(unquote(filename)).path.strip()) or clean_name
        opened = content is None
        if opened:
            if not self.exists(filename):
                return ''
            try:
                content = self.open(filename)
            except IOError:
                # Handle directory paths and fragments
                return name
        try:
            file_hash = self.file_hash(clean_name, content)
        finally:
            if opened:
                content.close()
        path, filename = os.path.split(clean_name)
        root, ext = os.path.splitext(filename)
        if file_hash is not None:
            file_hash = '.%s' % file_hash
        hashed_name = os.path.join(path, '%s%s%s' % (root, file_hash, ext))
        unparsed_name = list(parsed_name)
        unparsed_name[2] = hashed_name
        # Special casing for a @font-face hack, like url(myfont.eot?#iefix")
        # http://www.fontspring.com/blog/the-new-bulletproof-font-face-syntax
        if '?#' in name and not unparsed_name[3]:
            unparsed_name[2] += '?'
        return urlunsplit(unparsed_name)


class StorageProxyMixin:
    def url(self, name, storage_url=False, *args, **kwargs):
        if storage_url is True:
            return super().url(name, *args, **kwargs)
        return f'{settings.HOSTNAME}/storage-data/uploaded/?filepath={name}'


class CustomS3Boto3Storage(StorageProxyMixin, S3Boto3Storage):
    pass


class OssStorage(Storage):
    """Aliyun OSS upload backend (oss2 SDK, native signing).

    OSS endpoints reject AWS-style signatures (SigV2/V4), so S3Boto3Storage
    cannot talk to them; this backend goes through the official oss2 SDK with
    Aliyun-native signing. Files are served to the editor via presigned URLs
    (consistent with presign-enabled cloud mounts).

    Environment:
      STORAGE_TYPE=oss
      STORAGE_OSS_ENDPOINT=https://oss-cn-beijing.aliyuncs.com
      STORAGE_OSS_BUCKET_NAME=<bucket>
      STORAGE_OSS_ACCESS_KEY_ID=<ak>     (fallback: STORAGE_AWS_ACCESS_KEY_ID)
      STORAGE_OSS_SECRET_KEY=<sk>        (fallback: STORAGE_AWS_SECRET_ACCESS_KEY)
      STORAGE_OSS_URL_EXPIRE_SECONDS=3600 (optional presigned URL TTL)
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        access_key = get_env('STORAGE_OSS_ACCESS_KEY_ID') or get_env('STORAGE_AWS_ACCESS_KEY_ID')
        secret_key = get_env('STORAGE_OSS_SECRET_KEY') or get_env('STORAGE_AWS_SECRET_ACCESS_KEY')
        endpoint = get_env('STORAGE_OSS_ENDPOINT')
        bucket_name = get_env('STORAGE_OSS_BUCKET_NAME') or get_env('STORAGE_AWS_S3_BUCKET')
        if not all([access_key, secret_key, endpoint, bucket_name]):
            raise ImproperlyConfigured(
                'OSS upload storage requires STORAGE_OSS_ENDPOINT, STORAGE_OSS_BUCKET_NAME, '
                'STORAGE_OSS_ACCESS_KEY_ID and STORAGE_OSS_SECRET_KEY.'
            )
        self._bucket = oss2.Bucket(oss2.Auth(access_key, secret_key), endpoint, bucket_name)
        self._url_expire = int(get_env('STORAGE_OSS_URL_EXPIRE_SECONDS', 3600))

    def _open(self, name, mode='rb'):
        if mode != 'rb':
            raise ValueError('OssStorage supports read mode only')
        return File(self._bucket.get_object(name), name)

    def _save(self, name, content):
        self._bucket.put_object(name, content.read())
        return name

    def exists(self, name):
        return self._bucket.object_exists(name)

    def delete(self, name):
        try:
            self._bucket.delete_object(name)
        except oss2.exceptions.NoSuchKey:
            pass

    def size(self, name):
        return self._bucket.head_object(name).content_length

    def url(self, name, parameters=None, expire=None, method=None):
        # Presigned GET; slash_safe keeps object paths intact
        return self._bucket.sign_url('GET', name, expire or self._url_expire, slash_safe=True)

    def listdir(self, path):
        prefix = path.rstrip('/') + '/' if path else ''
        res = self._bucket.list_objects(prefix=prefix, delimiter='/')
        directories = [p.rstrip('/') for p in res.prefix_list]
        files = [o.key for o in res.object_list]
        return directories, files

    def get_modified_time(self, name):
        last_modified = self._bucket.head_object(name).last_modified
        return datetime.fromtimestamp(last_modified, tz=dt_timezone.utc)

    def get_created_time(self, name):
        # OSS exposes only Last-Modified; use it for both
        return self.get_modified_time(name)

    def get_accessed_time(self, name):
        raise NotImplementedError('OSS does not provide access time.')


class CustomAzureStorage(StorageProxyMixin, AzureStorage):
    pass


class AlternativeGoogleCloudStorageBase(GoogleCloudStorage):
    """A subclass to force the use of the IAM signBlob API
    This allows the signing of blob URLs without having to use a credential file.
    The service account must have the iam.serviceAccounts.signBlob permission."""

    def __init__(self, **settings):
        super().__init__(**settings)
        self._signing_credentials = None
        self._signing_credentials_lock = threading.Lock()

    def url(self, name):
        """
        Return public url or a signed url for the Blob.
        This DOES NOT check for existence of Blob - that makes codes too slow
        for many use cases.
        Overridden to force the use of the IAM signBlob API.
        See https://github.com/googleapis/python-storage/blob/519074112775c19742522158f612b467cf590219/google/cloud/storage/_signing.py#L628  # NOQA
        """
        name = self._normalize_name(clean_name(name))
        blob = self.bucket.blob(name)
        blob_params = self.get_object_parameters(name)
        no_signed_url = blob_params.get('acl', self.default_acl) == 'publicRead' or not self.querystring_auth

        if not self.custom_endpoint and no_signed_url:
            return blob.public_url
        elif no_signed_url:
            out = '{storage_base_url}/{quoted_name}'.format(
                storage_base_url=self.custom_endpoint,
                quoted_name=_quote(name, safe=b'/~'),
            )
            return out
        elif not self.custom_endpoint:
            out2 = blob.generate_signed_url(expiration=self.expiration, version='v4', **self._get_signing_kwargs())
            return out2
        else:
            out3 = blob.generate_signed_url(
                bucket_bound_hostname=self.custom_endpoint,
                expiration=self.expiration,
                version='v4',
                **self._get_signing_kwargs(),
            )
            return out3

    def _get_signing_credentials(self):
        with self._signing_credentials_lock:
            if self._signing_credentials is None or self._signing_credentials.expired:
                credentials, _ = google.auth.default(['https://www.googleapis.com/auth/cloud-platform'])
                auth_req = google.auth.transport.requests.Request()
                credentials.refresh(auth_req)
                self._signing_credentials = credentials
        return self._signing_credentials

    def _get_signing_kwargs(self):
        credentials = self._get_signing_credentials()
        out = {
            'service_account_email': credentials.service_account_email,
            'access_token': credentials.token,
            'credentials': credentials,
        }
        return out


class AlternativeGoogleCloudStorage(StorageProxyMixin, AlternativeGoogleCloudStorageBase):
    pass
