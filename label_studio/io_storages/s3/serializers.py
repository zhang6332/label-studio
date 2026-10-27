"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license."""

import logging
import os

from botocore.exceptions import ClientError, ParamValidationError
from botocore.handlers import validate_bucket_name
from core.utils.io import validate_url_for_ssrf
from django.conf import settings
from io_storages.s3.models import S3ExportStorage, S3ImportStorage
from io_storages.serializers import ExportStorageSerializer, ImportStorageSerializer, StorageTypeField
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


def _storage_label(storage) -> str:
    # OSS models inherit from the S3 ones (S3-compatible implementation); label
    # user-facing validation errors with the actual storage type, not always "S3".
    if storage is not None and type(storage).__name__.lower().startswith('oss'):
        return 'OSS'
    return 'S3'


class S3StorageSerializerMixin:
    secure_fields = ['aws_access_key_id', 'aws_secret_access_key', 'aws_session_token']

    def to_representation(self, instance):
        result = super().to_representation(instance)
        for attr in self.secure_fields:
            # tolerate subclasses that narrow Meta.fields/exclude
            result.pop(attr, None)
        return result

    def validate_s3_endpoint(self, value):
        # on the mixin: both import and export storages accept s3_endpoint
        if value and settings.SSRF_PROTECTION_ENABLED:
            validate_url_for_ssrf(value, block_local_urls=True)
        return value

    def validate_bucket(self, value):
        if not value:
            return value
        try:
            validate_bucket_name({'Bucket': value})
        except ParamValidationError as exc:
            raise ValidationError(exc.kwargs['report']) from exc
        return value

    def validate(self, data):
        data = super().validate(data)
        if not data.get('bucket', None):
            return data

        storage = self.instance
        if storage:
            for key, value in data.items():
                setattr(storage, key, value)
        else:
            if 'id' in self.initial_data:
                storage_object = self.Meta.model.objects.get(id=self.initial_data['id'])
                for attr in self.secure_fields:
                    data[attr] = data.get(attr) or getattr(storage_object, attr)
            storage = self.Meta.model(**data)
        try:
            storage.validate_connection()
        except ParamValidationError:
            raise ValidationError('Wrong credentials for {_label} {bucket_name}'.format(_label=_storage_label(storage), bucket_name=storage.bucket))
        except ClientError as e:
            # zjh: log the raw provider error so connect failures are diagnosable
            # (the user-facing message below is intentionally generic).
            logger.info(
                'S3/OSS validate_connection failed: code=%s message=%s endpoint=%s region=%s',
                e.response.get('Error', {}).get('Code'),
                e.response.get('Error', {}).get('Message'),
                getattr(storage, 's3_endpoint', None),
                getattr(storage, 'region_name', None),
            )
            if (
                e.response.get('Error').get('Code') in ['SignatureDoesNotMatch', '403']
                or e.response.get('ResponseMetadata').get('HTTPStatusCode') == 403
            ):
                raise ValidationError(
                    # zjh: surface the provider's own error code — the generic text alone
                    # made OSS/S3 connect failures undiagnosable (AccessDenied vs bad key).
                    'Cannot connect to {_label} {bucket_name} with the specified credentials (provider error: {code} {msg})'.format(
                        _label=_storage_label(storage),
                        bucket_name=storage.bucket,
                        code=e.response.get('Error', {}).get('Code'),
                        msg=e.response.get('Error', {}).get('Message'),
                    )
                )
            if (
                e.response.get('Error').get('Code') in ['NoSuchBucket', '404']
                or e.response.get('ResponseMetadata').get('HTTPStatusCode') == 404
            ):
                raise ValidationError('Cannot find bucket {bucket_name} in {_label}'.format(_label=_storage_label(storage), bucket_name=storage.bucket))
        except TypeError as e:
            logger.info(f'It seems access keys are incorrect: {e}', exc_info=True)
            raise ValidationError('It seems access keys are incorrect')
        except KeyError:
            raise ValidationError(f'{storage.url_scheme}://{storage.bucket}/{storage.prefix} not found.')
        return data


class S3ImportStorageSerializer(S3StorageSerializerMixin, ImportStorageSerializer):
    type = StorageTypeField(default=os.path.basename(os.path.dirname(__file__)))
    presign = serializers.BooleanField(required=False, default=True)

    class Meta:
        model = S3ImportStorage
        fields = '__all__'


class S3ExportStorageSerializer(S3StorageSerializerMixin, ExportStorageSerializer):
    type = StorageTypeField(default=os.path.basename(os.path.dirname(__file__)))

    class Meta:
        model = S3ExportStorage
        fields = '__all__'
