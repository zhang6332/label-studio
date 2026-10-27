"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging

import oss2
from rest_framework import serializers

from io_storages.oss.models import OssExportStorage, OssImportStorage
from io_storages.s3.serializers import S3StorageSerializerMixin
from io_storages.serializers import ExportStorageSerializer, ImportStorageSerializer

logger = logging.getLogger(__name__)


class OssStorageSerializerMixin:
    """Translate oss2 (Aliyun-native) errors into the same user-facing message
    style as the S3 serializers, keeping the provider error code visible."""

    def validate(self, data):
        try:
            return super().validate(data)
        except oss2.exceptions.OssError as e:
            bucket = data.get('bucket') or getattr(self.instance, 'bucket', '')
            detail = f'{e.code or e.status} {e.message or ""}'.strip()
            logger.info('OSS validate_connection failed: status=%s code=%s message=%s', e.status, e.code, e.message)
            if e.status == 404 or e.code in ('NoSuchBucket', 'NoSuchKey'):
                raise serializers.ValidationError(
                    f'Cannot find bucket {bucket} in OSS (provider error: {detail})'
                ) from e
            raise serializers.ValidationError(
                f'Cannot connect to OSS {bucket} with the specified credentials (provider error: {detail})'
            ) from e
        except ValueError as e:
            # from OssClientMixin._oss_client: missing endpoint configuration
            raise serializers.ValidationError(f'OSS storage is misconfigured: {e}') from e


class OssImportStorageSerializer(OssStorageSerializerMixin, S3StorageSerializerMixin, ImportStorageSerializer):
    type = serializers.ReadOnlyField(default='oss')
    presign = serializers.BooleanField(required=False, default=True)

    class Meta:
        model = OssImportStorage
        fields = '__all__'


class OssExportStorageSerializer(OssStorageSerializerMixin, S3StorageSerializerMixin, ExportStorageSerializer):
    type = serializers.ReadOnlyField(default='oss')

    class Meta:
        model = OssExportStorage
        fields = '__all__'
