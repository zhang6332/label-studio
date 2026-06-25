"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
from io_storages.api import (
    ExportStorageDetailAPI,
    ExportStorageFormLayoutAPI,
    ExportStorageListAPI,
    ExportStorageSyncAPI,
    ExportStorageValidateAPI,
    ImportStorageDetailAPI,
    ImportStorageFormLayoutAPI,
    ImportStorageListAPI,
    ImportStorageSyncAPI,
    ImportStorageValidateAPI,
)
from io_storages.oss.models import OssExportStorage, OssImportStorage
from io_storages.oss.serializers import OssExportStorageSerializer, OssImportStorageSerializer


class OssImportStorageListAPI(ImportStorageListAPI):
    queryset = OssImportStorage.objects.all()
    serializer_class = OssImportStorageSerializer


class OssImportStorageDetailAPI(ImportStorageDetailAPI):
    queryset = OssImportStorage.objects.all()
    serializer_class = OssImportStorageSerializer


class OssImportStorageSyncAPI(ImportStorageSyncAPI):
    serializer_class = OssImportStorageSerializer


class OssImportStorageValidateAPI(ImportStorageValidateAPI):
    serializer_class = OssImportStorageSerializer


class OssImportStorageFormLayoutAPI(ImportStorageFormLayoutAPI):
    pass


class OssExportStorageListAPI(ExportStorageListAPI):
    queryset = OssExportStorage.objects.all()
    serializer_class = OssExportStorageSerializer


class OssExportStorageDetailAPI(ExportStorageDetailAPI):
    queryset = OssExportStorage.objects.all()
    serializer_class = OssExportStorageSerializer


class OssExportStorageSyncAPI(ExportStorageSyncAPI):
    serializer_class = OssExportStorageSerializer


class OssExportStorageValidateAPI(ExportStorageValidateAPI):
    serializer_class = OssExportStorageSerializer


class OssExportStorageFormLayoutAPI(ExportStorageFormLayoutAPI):
    pass
