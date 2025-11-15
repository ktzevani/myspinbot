from __future__ import annotations

import asyncio
import redis.asyncio as redis

from typing import Any, Dict, List, Optional, TypeAlias, Callable, Awaitable
from redis.exceptions import ResponseError
from enum import StrEnum

from .utils import json_dumps_safe
from .models.jobs.job_messaging_schema import DataUpdate, ProgressUpdate, StatusUpdate

PublishHook: TypeAlias = Callable[
    [ProgressUpdate | StatusUpdate | DataUpdate], Awaitable[None]
]


class PubSubChannels(StrEnum):
    PROGRESS = "channel:progress"
    STATUS = "channel:status"
    DATA = "channel:data"


class RedisBridge:
    """
    High-level asynchronous wrapper around Redis Streams providing
    structured publish/consume operations for job messages, and
    advertise operation to subscribers of pub/sub channels.
    """

    def __init__(self, redis_url: str, streams: List[str], group: str = "worker-group"):
        self.redis_url = redis_url
        self.streams = streams
        self.group = group
        current_task = asyncio.current_task()
        self.consumer = (
            f"consumer-{current_task.get_name() if current_task else 'default'}"
        )
        self.redis: Optional[redis.Redis] = None

    async def _create_group(self) -> None:
        """Create group."""
        if not self.redis:
            raise RuntimeError("Redis not connected")

        for stream in self.streams:
            try:
                await self.redis.xgroup_create(
                    name=stream, groupname=self.group, id="0-0", mkstream=True
                )
                print(
                    f"[RedisBridge] 🧩 Created group '{self.group}' for stream '{stream}'"
                )
            except ResponseError as exc:
                if "BUSYGROUP" in str(exc):
                    continue
                raise

    # ------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------

    async def connect(self) -> None:
        """Create a Redis connection pool."""
        self.redis = redis.from_url(
            self.redis_url,
            decode_responses=False,  # keep responses as bytes
            encoding="utf-8",  # ✅ required for outgoing command encoding
        )
        print(f"[RedisBridge] ✅ Connected to {self.redis_url}")
        await self._create_group()
        print(f"[RedisBridge] ✅ Group {self.group} is created.")

    async def close(self) -> None:
        """Close the Redis connection."""
        if self.redis:
            await self.redis.close()
            await self.redis.connection_pool.disconnect()
            print("[RedisBridge] 🔌 Connection closed.")

    # ------------------------------------------------------------
    # Job publishing
    # ------------------------------------------------------------

    async def enqueue(self, stream: str, jobId: str, payload: Dict[str, Any]) -> None:
        """Add a job to the specified stream."""
        if not self.redis:
            raise RuntimeError("Redis not connected")

        data = {k: json_dumps_safe(v) for k, v in payload.items()}
        await self.redis.xadd(stream, fields=data)  # type: ignore[arg-type]
        print(f"[RedisBridge] ➕ Enqueued job {jobId} into stream '{stream}'")

    # ------------------------------------------------------------
    # Polling interface
    # ------------------------------------------------------------

    async def poll(
        self, batch_size: int = 10, timeout: int = 1000
    ) -> list[dict[str, Any]]:
        """
        Poll Redis Streams for new messages, returning decoded raw entries.

        Args:
            batch_size: Maximum number of entries to read per stream.
            timeout: Blocking timeout in milliseconds for XREADGROUP.

        Returns:
            A list of dictionaries with shape:
            {
                "stream": str,
                "xid": str,
                "fields": dict[str, str]
            }
        """
        results: list[dict[str, Any]] = []
        if not self.redis or not self.streams:
            return results

        try:
            entries = await self.redis.xreadgroup(
                groupname=self.group,
                consumername=self.consumer,
                streams={s: ">" for s in self.streams},
                count=batch_size,
                block=timeout,
            )

            for stream_name, messages in entries or []:
                stream_str = (
                    stream_name.decode()
                    if isinstance(stream_name, bytes)
                    else stream_name
                )

                for xid, fields in messages:
                    xid_str = xid.decode() if isinstance(xid, bytes) else xid
                    decoded_fields = {
                        (k.decode() if isinstance(k, bytes) else k): (
                            v.decode() if isinstance(v, bytes) else v
                        )
                        for k, v in fields.items()
                    }
                    results.append(
                        {
                            "stream": stream_str,
                            "xid": xid_str,
                            "fields": decoded_fields,
                        }
                    )

        except Exception as exc:
            print(f"[RedisBridge] ⚠️ Poll error: {exc}")
            await asyncio.sleep(0.5)

        return results

    # ------------------------------------------------------------
    # Acknowledgment
    # ------------------------------------------------------------

    async def ack(self, stream: str, xid: str) -> bool:
        """
        Acknowledge a processed message, removing it from the pending list.

        Args:
            stream: The Redis stream name.
            xid: The message ID to acknowledge.

        Returns:
            True if successfully acknowledged, False otherwise.
        """
        if not self.redis:
            raise RuntimeError("Redis not connected")

        try:
            acked = await self.redis.xack(stream, self.group, xid)
            if acked:
                print(f"[RedisBridge] 🧾 Acknowledged {xid} on '{stream}'")
            return bool(acked)
        except Exception as exc:
            print(f"[RedisBridge] ⚠️ Ack error on '{stream}' ({xid}): {exc}")
            return False

    # ------------------------------------------------------------
    # Pub/Sub interface
    # ------------------------------------------------------------

    async def publish(self, channel: str, payload: str) -> None:
        """
        Publish a JSON-encoded payload to a Redis Pub/Sub channel.

        Args:
            channel: Name of the channel to publish to.
            payload: JSON string.
        """
        if not self.redis:
            raise RuntimeError("Redis not connected")

        try:
            await self.redis.publish(channel, payload)
            # Optional local logging
            # print(f"[RedisBridge] 📢 Published to {channel}: {data}")
        except Exception as exc:
            print(f"[RedisBridge] ⚠️ Publish error on '{channel}': {exc}")
