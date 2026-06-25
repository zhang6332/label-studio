"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import os

from io_storages.oss.models import OssExportStorage, OssImportStorage
from io_storages.s3.serializers import S3StorageSerializerMixin
from io_storages.serializers import ExportStorageSerializer, ImportStorageSerializer
from rest_framework import serializers


class OssImportStorageSerializer(S3StorageSerializerMixin, ImportStorageSerializer):
    type = serializers.ReadOnlyField(default=os.path.basename(os.path.dirname(__file__)))
    presign = serializers.BooleanField(required=False, default=True)

    class Meta:
        model = OssImportStorage
        fields = '__all__'


class OssExportStorageSerializer(S3StorageSerializerMixin, ExportStorageSerializer):
    type = serializers.ReadOnlyField(default=os.path.basename(os.path.dirname(__file__)))

    class Meta:
        model = OssExportStorage
        fields = '__all__'
