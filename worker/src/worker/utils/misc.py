import asyncio
import json
import signal
from typing import Any


def setup_graceful_shutdown(stop_event: asyncio.Event):
    """Attach SIGINT/SIGTERM handlers to set an asyncio.Event."""
    loop = asyncio.get_running_loop()

    def _signal_handler(*_: Any):
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            pass


def json_dumps_safe(obj: Any) -> str:
    """Serialize to JSON safely, falling back to string conversion."""
    try:
        return json.dumps(obj, ensure_ascii=False, default=str)
    except Exception:
        return json.dumps(str(obj))
