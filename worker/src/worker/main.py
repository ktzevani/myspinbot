from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from .bridge import RedisBridge, PubSubChannels, PublishHook
from .models.jobs.job_messaging_schema import (
    JobMessage,
    DataUpdate,
    ProgressUpdate,
    StatusUpdate,
)
from .tasks import get_task_for_job

from .utils import get_metrics, setup_graceful_shutdown
from .config import get_config

# -- Configuration & Metrics

worker_config = get_config()
prometheus_registry, prometheus_metrics = get_metrics()

worker_active_tasks = prometheus_metrics["worker_active_tasks"]
worker_jobs_total = prometheus_metrics["worker_jobs_total"]
worker_job_duration_seconds = prometheus_metrics["worker_job_duration_seconds"]
worker_loop_iterations_total = prometheus_metrics["worker_loop_iterations_total"]
worker_poll_batch_size = prometheus_metrics["worker_poll_batch_size"]

# Module singleton
app = FastAPI()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application lifespan: manages Redis bridge and dispatch loop lifecycle."""

    app.state.bridge = RedisBridge(
        worker_config["REDIS_URL"],
        worker_config["WORKER_STREAMS"],
        worker_config["WORKER_GROUP"],
    )
    bridge = app.state.bridge

    await bridge.connect()

    stop_event = asyncio.Event()
    setup_graceful_shutdown(stop_event)

    app.state.dispatcher = asyncio.create_task(dispatch_loop(bridge, stop_event))
    dispatcher = app.state.dispatcher

    try:
        yield
    finally:
        stop_event.set()
        if dispatcher:
            dispatcher.cancel()
            with suppress(asyncio.CancelledError):
                await dispatcher
        if bridge:
            await bridge.close()


app.router.lifespan_context = lifespan


# -- Task dispatcher logic


async def dispatch_loop(bridge: RedisBridge, stop_event: asyncio.Event):
    """Main dispatch loop that continuously consumes from Redis bridge."""

    print("[Worker] 🚀 Starting dispatch loop...")

    channels = {
        "ProgressUpdate": PubSubChannels.PROGRESS,
        "StatusUpdate": PubSubChannels.STATUS,
        "DataUpdate": PubSubChannels.DATA,
    }

    async def publish_message(
        payload: ProgressUpdate | StatusUpdate | DataUpdate,
    ):
        try:
            base = channels[payload.__class__.__name__]
            channel = f"{base}:{payload.jobId}"
            await bridge.publish(channel, payload.model_dump_json())
        except Exception as exc:
            print(f"[Worker] ⚠️ Failed to publish: {exc}")

    while not stop_event.is_set():
        worker_loop_iterations_total.inc()
        try:
            raw_messages = await bridge.poll(worker_config["WORKER_BATCH_SIZE"], 1000)
            messages = [
                JobMessage.model_validate(
                    {**msg["fields"], "xid": msg["xid"], "stream": msg["stream"]}
                )
                for msg in raw_messages
            ]
            worker_poll_batch_size.observe(len(messages))
            for entry in messages:
                await process_entry(entry, publish_message)
                await bridge.ack(entry.stream, entry.xid)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            print(f"[Worker] ⚠️ Polling error: {exc}")
            await asyncio.sleep(1)
    print("[Worker] 💤 Worker loop stopped.")


async def process_entry(entry: JobMessage, publish_hook: PublishHook):
    """Process an entry pulled from Redis Stream."""
    try:
        task = get_task_for_job(entry.name)
        worker_active_tasks.inc()
        worker_jobs_total.labels(type=entry.name).inc()
        with worker_job_duration_seconds.labels(type=entry.name).time():
            await task(entry.jobId, publish_hook)
    except Exception as exc:
        print(f"[Worker] ❌ Error while processing {entry.jobId}: {exc}")
    finally:
        worker_active_tasks.dec()


# -- Routes


@app.get("/health")
async def health():
    """Simple health endpoint."""
    return {"status": "ok"}


@app.get("/metrics")
async def metrics():
    """Expose Prometheus metrics."""
    return Response(
        generate_latest(prometheus_registry), media_type=CONTENT_TYPE_LATEST
    )


# -- Entrypoint


def run():
    """Entry point for local execution."""
    import uvicorn

    uvicorn.run(
        "worker.main:app",
        host=worker_config["WORKER_HTTP_HOST"],
        port=worker_config["WORKER_HTTP_PORT"],
        reload=False,
    )


if __name__ == "__main__":
    run()
