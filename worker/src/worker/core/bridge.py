from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, TypeAlias

import redis.asyncio as redis
from redis.exceptions import ResponseError

from ..models.jobs.job_messaging_schema import DataUpdate, ProgressUpdate, StatusUpdate
from ..models.redis.redis_config_schema import RedisConfiguration
from ..utils.misc import json_dumps_safe

PublishHook: TypeAlias = Callable[
    [ProgressUpdate | StatusUpdate | DataUpdate], Awaitable[None]
]


def _current_timestamp_ms() -> str:
    """Return the current time in milliseconds as a string."""
    return str(int(datetime.now(timezone.utc).timestamp() * 1000))


class RedisBridge:
    """
    Async Redis helper that wraps stream consumption and pub/sub publishing.

    It mirrors the capabilities of the Node.js JobQueue so both planes share
    a comparable API surface for enqueuing graphs, acknowledging entries, and
    emitting progress updates.
    """

    def __init__(self, configuration: RedisConfiguration, group: str):
        self.redis_url = configuration.url
        self.channels = configuration.channels
        self.group = group
        self.job_ttl = configuration.jobs.ttl
        self.stream_roots = configuration.streams
        self.stream_process_data = f"{self.stream_roots.process}:data"
        self.stream_process_control = f"{self.stream_roots.process}:control"
        self.stream_info_data = f"{self.stream_roots.info}:data"
        self.stream_plan_data = (
            f"{self.stream_roots.plan}:data" if self.stream_roots.plan else None
        )
        self._managed_streams = [
            stream
            for stream in [
                self.stream_info_data,
                self.stream_process_data,
                self.stream_plan_data,
            ]
            if stream
        ]
        current_task = asyncio.current_task()
        self.consumer = (
            f"consumer-{current_task.get_name() if current_task else 'default'}"
        )
        self.redis: Optional[redis.Redis] = None

    # ------------------------------------------------------------------
    # Connection & group management
    # ------------------------------------------------------------------

    async def _create_group(self) -> None:
        """Create consumer groups for all managed streams."""
        if not self.redis:
            raise RuntimeError("Redis not connected")

        for stream in self._managed_streams:
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

    async def connect(self) -> None:
        """Create the Redis connection pool and ensure groups exist."""
        self.redis = redis.from_url(
            self.redis_url,
            decode_responses=False,
            encoding="utf-8",
        )
        print(f"[RedisBridge] ✅ Connected to {self.redis_url}")
        await self._create_group()
        print(f"[RedisBridge] ✅ Group {self.group} is ready.")

    async def close(self) -> None:
        """Close the Redis connection."""
        if self.redis:
            await self.redis.close()
            await self.redis.connection_pool.disconnect()
            print("[RedisBridge] 🔌 Connection closed.")

    # ------------------------------------------------------------------
    # Stream helpers
    # ------------------------------------------------------------------

    async def _read_streams(
        self, streams: Dict[Any, Any], count: int, block: int
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        if not self.redis or not streams:
            return results

        try:
            entries = await self.redis.xreadgroup(
                groupname=self.group,
                consumername=self.consumer,
                streams=streams,
                count=count,
                block=block,
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
                        {"stream": stream_str, "xid": xid_str, "fields": decoded_fields}
                    )
        except Exception as exc:
            print(f"[RedisBridge] ⚠️ Poll error: {exc}")
            await asyncio.sleep(0.5)

        return results

    async def poll_job(self, timeout: int = 200) -> Dict[str, Any] | None:
        """Poll the process:data stream for workflow graphs."""
        entries = await self._read_streams({self.stream_process_data: ">"}, 1, timeout)
        if len(entries) > 0:
            return entries[0]
        return None

    async def ack_job(self, xid: str) -> bool:
        """
        Acknowledge a processed job, removing it from the pending list.
        """
        if not self.redis:
            raise RuntimeError("Redis not connected")
        stream = self.stream_process_data
        try:
            acked = await self.redis.xack(stream, self.group, xid)
            if acked:
                print(f"[RedisBridge] 🧾 Acknowledged {xid} on '{stream}'")
            return bool(acked)
        except Exception as exc:
            print(f"[RedisBridge] ⚠️ Ack error on '{stream}' ({xid}): {exc}")
            return False

    # ------------------------------------------------------------------
    # Job persistence helpers
    # ------------------------------------------------------------------

    async def set_job_payload(self, job_id: str, payload: Any) -> None:
        """Persist the latest graph payload for observability/debugging."""
        if not self.redis:
            raise RuntimeError("Redis not connected")
        serialized = payload if isinstance(payload, str) else json_dumps_safe(payload)
        key = f"job:{job_id}"
        pipeline = self.redis.pipeline()
        pipeline.hset(
            key,
            mapping={
                "graph": serialized,
                "created": _current_timestamp_ms(),
            },
        )
        pipeline.expire(key, self.job_ttl)
        await pipeline.execute()

    async def enqueue_control_job(self, job_id: str, graph: Any) -> None:
        """Send a graph back to the control-plane stream."""
        if not self.redis:
            raise RuntimeError("Redis not connected")

        graph_str = graph if isinstance(graph, str) else json_dumps_safe(graph)
        created = _current_timestamp_ms()
        await self.redis.xadd(
            self.stream_process_control,
            fields={"jobId": job_id, "created": created, "graph": graph_str},
        )

    # ------------------------------------------------------------------
    # Pub/Sub helpers
    # ------------------------------------------------------------------

    async def publish(self, channel: str, payload: str) -> None:
        """Publish a JSON payload to a channel."""
        if not self.redis:
            raise RuntimeError("Redis not connected")

        try:
            await self.redis.publish(channel, payload)
        except Exception as exc:
            print(f"[RedisBridge] ⚠️ Publish error on '{channel}': {exc}")

    async def publish_update(
        self, payload: ProgressUpdate | StatusUpdate | DataUpdate
    ) -> None:
        """Route strongly-typed updates onto the correct channel."""
        mapping = {
            ProgressUpdate: self.channels.progress,
            StatusUpdate: self.channels.status,
            DataUpdate: self.channels.data,
        }
        base = mapping[payload.__class__]
        channel = f"{base}:{payload.jobId}"
        await self.publish(channel, payload.model_dump_json())
