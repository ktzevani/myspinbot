from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import FastAPI

from .core.bridge import RedisBridge
from .core.executor import Executor
from .services.tasks import get_task_registry
from .config import get_config
from .api.router import router as api_router

worker_config = get_config()
app = FastAPI()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application lifespan: manages Redis bridge and dispatch loop lifecycle."""

    app.state.bridge = RedisBridge(
        worker_config.bridge,
        worker_config.streams.group,
    )
    bridge: RedisBridge = app.state.bridge
    await bridge.connect()

    app.state.executor = Executor(
        bridge=bridge,
        task_registry=get_task_registry(),
        poll_interval=0.5,
    )
    executor: Executor = app.state.executor
    await executor.start()

    try:
        yield
    finally:
        if executor:
            await executor.stop()
        if bridge:
            await bridge.close()


app.router.lifespan_context = lifespan

# --- Register routes
app.include_router(api_router)


def run():
    import uvicorn

    uvicorn.run(
        "worker.main:app",
        host=worker_config.server.host,
        port=worker_config.server.port,
        reload=False,
    )


if __name__ == "__main__":
    run()
