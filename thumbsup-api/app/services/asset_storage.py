"""Where ThumbsUp keeps its copies of customers' Drive files.

  local -> a folder on the server's disk (fine for one server with a persistent volume)
  s3    -> Amazon S3, Cloudflare R2 (no download fees) or any S3-compatible storage
  azure -> Azure Blob Storage (connection string, or the server's managed identity)
"""

import os
import shutil
import threading

from app.config import settings


class LocalStorage:
    def __init__(self, root: str):
        self.root = os.path.abspath(root)

    def _path(self, key: str) -> str:
        path = os.path.abspath(os.path.join(self.root, key))
        if not path.startswith(self.root + os.sep):
            raise ValueError("invalid storage key")
        return path

    def put_file(self, key: str, src_path: str, content_type: str) -> None:
        dest = self._path(key)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.move(src_path, dest)

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        dest = self._path(key)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        tmp = dest + ".tmp"
        with open(tmp, "wb") as fh:
            fh.write(data)
        os.replace(tmp, dest)

    def exists(self, key: str) -> bool:
        return os.path.exists(self._path(key))

    def local_path(self, key: str) -> str | None:
        return self._path(key)

    def read_bytes(self, key: str) -> bytes:
        with open(self._path(key), "rb") as fh:
            return fh.read()

    def open_range(self, key: str, start: int | None, end: int | None):
        raise NotImplementedError  # local files are served with FileResponse (handles ranges)

    def delete_prefix(self, prefix: str) -> None:
        shutil.rmtree(self._path(prefix.rstrip("/")), ignore_errors=True)

    def delete(self, key: str) -> None:
        try:
            os.remove(self._path(key))
        except FileNotFoundError:
            pass


class S3Storage:
    def __init__(self):
        import boto3

        kwargs = {
            "aws_access_key_id": settings.S3_ACCESS_KEY_ID,
            "aws_secret_access_key": settings.S3_SECRET_ACCESS_KEY,
            "region_name": settings.S3_REGION or "auto",
        }
        if settings.S3_ENDPOINT_URL:
            kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
        self.s3 = boto3.client("s3", **kwargs)
        self.bucket = settings.S3_BUCKET

    def put_file(self, key: str, src_path: str, content_type: str) -> None:
        self.s3.upload_file(src_path, self.bucket, key, ExtraArgs={"ContentType": content_type})
        os.remove(src_path)

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def exists(self, key: str) -> bool:
        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:  # noqa: BLE001
            return False

    def local_path(self, key: str) -> str | None:
        return None

    def read_bytes(self, key: str) -> bytes:
        return self.s3.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def open_range(self, key: str, start: int | None, end: int | None):
        args = {"Bucket": self.bucket, "Key": key}
        if start is not None:
            args["Range"] = f"bytes={start}-{'' if end is None else end}"
        obj = self.s3.get_object(**args)
        return obj["Body"], obj.get("ContentLength"), obj.get("ContentRange")

    def delete_prefix(self, prefix: str) -> None:
        paginator = self.s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            keys = [{"Key": o["Key"]} for o in page.get("Contents", [])]
            if keys:
                self.s3.delete_objects(Bucket=self.bucket, Delete={"Objects": keys})

    def delete(self, key: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=key)


class AzureBlobStorage:
    """Azure Blob Storage. On Azure, prefer a managed identity (no secret in the settings):
    set AZURE_STORAGE_ACCOUNT_URL and give the app the "Storage Blob Data Contributor" role."""

    def __init__(self):
        from azure.storage.blob import BlobServiceClient

        if settings.AZURE_STORAGE_CONNECTION_STRING:
            service = BlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION_STRING)
        else:
            from azure.identity import DefaultAzureCredential

            service = BlobServiceClient(settings.AZURE_STORAGE_ACCOUNT_URL, credential=DefaultAzureCredential())
        self.container = service.get_container_client(settings.AZURE_STORAGE_CONTAINER)

    def _blob(self, key: str):
        return self.container.get_blob_client(key)

    def put_file(self, key: str, src_path: str, content_type: str) -> None:
        from azure.storage.blob import ContentSettings

        with open(src_path, "rb") as fh:
            self._blob(key).upload_blob(fh, overwrite=True, content_settings=ContentSettings(content_type=content_type),
                                        max_concurrency=4)
        os.remove(src_path)

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        from azure.storage.blob import ContentSettings

        self._blob(key).upload_blob(data, overwrite=True, content_settings=ContentSettings(content_type=content_type))

    def exists(self, key: str) -> bool:
        return self._blob(key).exists()

    def local_path(self, key: str) -> str | None:
        return None

    def read_bytes(self, key: str) -> bytes:
        return self._blob(key).download_blob().readall()

    def open_range(self, key: str, start: int | None, end: int | None):
        blob = self._blob(key)
        size = blob.get_blob_properties().size
        if start is None:
            stream = blob.download_blob()
            return _ChunkReader(stream), size, None
        last = size - 1 if end is None else min(end, size - 1)
        stream = blob.download_blob(offset=start, length=last - start + 1)
        return _ChunkReader(stream), last - start + 1, f"bytes {start}-{last}/{size}"

    def delete_prefix(self, prefix: str) -> None:
        names = [b.name for b in self.container.list_blobs(name_starts_with=prefix)]
        for i in range(0, len(names), 250):
            self.container.delete_blobs(*names[i:i + 250])

    def delete(self, key: str) -> None:
        from azure.core.exceptions import ResourceNotFoundError

        try:
            self._blob(key).delete_blob()
        except ResourceNotFoundError:
            pass


class _ChunkReader:
    """Gives an Azure download the same .read()/.iter_chunks()/.close() shape as an S3 body."""

    def __init__(self, downloader):
        self._chunks = downloader.chunks()

    def iter_chunks(self, chunk_size: int = 256 * 1024):
        yield from self._chunks

    def read(self) -> bytes:
        return b"".join(self._chunks)

    def close(self) -> None:
        pass


_storage = None
_lock = threading.Lock()


def get_storage():
    global _storage
    with _lock:
        if _storage is None:
            if settings.ASSET_STORAGE.lower() == "s3":
                _storage = S3Storage()
            elif settings.ASSET_STORAGE.lower() == "azure":
                _storage = AzureBlobStorage()
            else:
                _storage = LocalStorage(os.path.join(settings.STORAGE_DIR, "assets"))
        return _storage


def reset_storage() -> None:
    global _storage
    _storage = None
