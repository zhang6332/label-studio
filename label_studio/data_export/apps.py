"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license."""

from django.apps import AppConfig


class DataExportConfig(AppConfig):
    name = 'data_export'

    def ready(self):
        _extend_cloud_uri_schemes_for_oss()


def _extend_cloud_uri_schemes_for_oss():
    """zjh: teach the converter tooling about the Aliyun OSS 'oss://' scheme.

    The vendored converter download() routes cloud URIs (s3:/gs:/azure-blob:) to
    get_local_path -> /tasks/<id>/presign/, but its scheme check predates the OSS
    storage module, so oss:// URIs fell through to plain http_get and failed —
    'with Images' export formats packed no images. Aliyun OSS storage speaks the
    same presign endpoint, so extending the check is sufficient.
    """
    from label_studio_sdk._extensions.label_studio_tools.core.utils import io as ls_io

    if getattr(ls_io.is_cloud_storage_uri, "_oss_extended", False):
        return

    def is_cloud_storage_uri_with_oss(url):
        if isinstance(url, str) and url.startswith("oss:"):
            return True
        return ls_io.is_cloud_storage_uri(url)

    is_cloud_storage_uri_with_oss._oss_extended = True
    ls_io.is_cloud_storage_uri = is_cloud_storage_uri_with_oss
