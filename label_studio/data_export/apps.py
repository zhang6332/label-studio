"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license."""

from django.apps import AppConfig


class DataExportConfig(AppConfig):
    name = 'data_export'

    def ready(self):
        try:
            _patch_upload_url_unquote()
            _extend_cloud_uri_schemes_for_oss()
            # Re-bind into the converter module: it imported the originals at load
            # time, so replacing the io module attributes alone leaves the
            # converter calling the unpatched functions.
            from label_studio_sdk.converter import converter as ls_conv_mod
            from label_studio_sdk._extensions.label_studio_tools.core.utils import io as ls_io

            ls_conv_mod.get_local_path = ls_io.get_local_path
            ls_conv_mod.is_cloud_storage_uri = ls_io.is_cloud_storage_uri
        except ImportError as e:
            # zjh: never block startup if the SDK layout changes on upgrade —
            # exports degrade to the pre-patch behavior instead.
            from django.core.exceptions import AppRegistryNotReady

            import logging

            logging.getLogger(__name__).warning('OSS export compat patches skipped (SDK import moved): %s', e)
        except Exception as e:
            import logging

            logging.getLogger(__name__).warning('OSS export compat patches failed: %s', e)


def _patch_upload_url_unquote():
    """zjh: /data/upload URLs carry percent-encoded filenames, while files on
    disk are stored decoded (CJK names). get_local_path builds the local path
    from the encoded basename and fails; retry once with the decoded URL."""
    from label_studio_sdk._extensions.label_studio_tools.core.utils import io as ls_io

    if getattr(ls_io.get_local_path, "_unquote_retried", False):
        return

    original = ls_io.get_local_path

    def get_local_path_with_unquote(url, **kwargs):
        try:
            return original(url, **kwargs)
        except Exception as first_error:
            from urllib.parse import unquote

            if isinstance(url, str) and url.startswith("/data/upload") and "%" in url:
                decoded = unquote(url)
                if decoded != url:
                    try:
                        return original(decoded, **kwargs)
                    except Exception:
                        pass
            raise first_error

    get_local_path_with_unquote._unquote_retried = True
    ls_io.get_local_path = get_local_path_with_unquote


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

    original_is_cloud_storage_uri = ls_io.is_cloud_storage_uri

    def is_cloud_storage_uri_with_oss(url):
        if isinstance(url, str) and url.startswith("oss:"):
            return True
        return original_is_cloud_storage_uri(url)

    is_cloud_storage_uri_with_oss._oss_extended = True
    ls_io.is_cloud_storage_uri = is_cloud_storage_uri_with_oss
