from io import BytesIO
from minio import Minio
from minio.error import S3Error
from datetime import datetime, timezone
from ..models.storage.artifact_schema import ArtifactMeta, ArtifactUploadResult
from ..config import get_config

_worker_config = get_config()


def _connect_minio() -> Minio:
    """Return a configured MinIO client using env variables."""
    return Minio(
        _worker_config.storage.url.replace("http://", "").replace("https://", ""),
        _worker_config.storage.access_key,
        _worker_config.storage.secret_key,
        secure=_worker_config.storage.url.startswith("https://"),
    )


def is_bucket_valid(bucket: str) -> bool:
    return bucket in _worker_config.storage.buckets


def fetch_torch_image(objectPath: str) -> tuple:
    from PIL import Image
    import numpy as np
    import torch

    bucket, key = objectPath.split("/", 1)
    client = _connect_minio()
    response = client.get_object(bucket, key)
    try:
        raw_image_data = BytesIO(response.read())
        img = Image.open(raw_image_data).convert("RGB")
        img_np = np.array(img).astype(np.float32) / 255.0
        image_tensor = torch.from_numpy(img_np)[None,]
    finally:
        response.close()
        response.release_conn()
    return (image_tensor,)


def fetch_torch_audio(objectPath: str) -> tuple:
    import torchaudio

    bucket, key = objectPath.split("/", 1)
    client = _connect_minio()
    response = client.get_object(bucket, key)
    try:
        raw_audio_data = BytesIO(response.read())
        waveform, sample_rate = torchaudio.load(raw_audio_data)
    finally:
        response.close()
        response.release_conn()
    return (waveform, sample_rate)


def download_to_local_path(objectPath: str, localPath: str) -> str:
    import os
    import uuid

    bucket, key = objectPath.split("/", 1)
    os.makedirs(localPath, exist_ok=True)
    local_filename = f"{uuid.uuid4().hex}_{os.path.basename(key)}"
    local_path = os.path.join(localPath, local_filename)
    client = _connect_minio()
    client.fget_object(bucket, key, local_path)
    return local_path


def upload_bytes(
    bucket: str,
    name: str,
    content: bytes,
    content_type: str = "application/octet-stream",
) -> ArtifactUploadResult:
    """Upload bytes to MinIO and return typed metadata."""
    if not is_bucket_valid(bucket):
        raise RuntimeError(f"Invalid bucket name: {bucket}")
    client = _connect_minio()
    try:
        buffer = BytesIO(content)
        size = len(content)
        client.put_object(
            bucket_name=bucket,
            object_name=name,
            data=buffer,
            length=size,
            content_type=content_type,
        )
        meta = ArtifactMeta(
            bucket=bucket,
            key=name,
            size_bytes=size,
            created_at=datetime.now(timezone.utc),
            content_type=content_type,
        )
        return ArtifactUploadResult(ok=True, meta=meta)
    except S3Error as exc:  # pragma: no cover - network error path
        raise RuntimeError(f"Failed to upload {name}: {exc}") from exc
