from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, constr
from ..redis.redis_config_schema import RedisConfiguration


class StreamsConfig(BaseModel):
    group: str = Field(..., description="Group name of redis stream consumers")
    batch_size: int = Field(
        ..., description="Number of stream messages to poll in batch"
    )


class ServerConfig(BaseModel):
    host: str = Field(..., description="Network intefaces for Unicorn to bind to")
    port: int = Field(..., description="TCP port to listen on")


class ComfyConfig(BaseModel):
    root_dir: str = Field(..., description="Absolute path to root directory")


class StorageConfiguration(BaseModel):
    """Configuration for object storage."""

    url: constr(pattern=r"^http://.+") = Field(
        ..., description="Minio connection string (e.g. 'http://minio:9000')."
    )
    use_ssl: bool = Field(..., description="Endpoint uses SSL encryption")
    buckets: list[str] = Field(
        ..., description="List of bucket names supporting anonymous access"
    )
    access_key: str = Field(..., description="Object storage access key")
    secret_key: str = Field(..., description="Object storage access secret")


class WorkerConfiguration(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    streams: StreamsConfig = Field(
        ..., description="Application-specific redis streams configuration."
    )
    server: ServerConfig = Field(..., description="Unicorn server configuration")

    comfy: ComfyConfig = Field(..., description="ComfyUI configuration")

    storage: StorageConfiguration = Field(
        ..., description="Configuration of object storage"
    )
    bridge: RedisConfiguration = Field(
        ...,
        description="Configuration of redis bridge, contains parameterization for redis streams and pub/sub.",
    )
