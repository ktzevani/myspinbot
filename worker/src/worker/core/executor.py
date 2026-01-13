from __future__ import annotations

import asyncio
import json
from enum import Enum
from contextlib import suppress
from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Optional

from pydantic import ValidationError

from .bridge import RedisBridge
from ..models.jobs.job_messaging_schema import JobStatus
from ..models.langgraph.graph_schema import LanggraphWorkflow, NodeStatus, Plane
from ..services.tasks import WorkerTask
from ..infra.metrics import MetricType, get_or_create_metric


@dataclass(slots=True)
class ExecutorResult:
    job_id: str
    entry_id: str
    graph: Dict[str, Any]
    status: str


class ExecutorJobError(Exception):
    """Raised when a job cannot be processed (invalid payload, missing fields, etc.)."""

    def __init__(self, message: str, entry_id: str, job_id: Optional[str]):
        super().__init__(message)
        self.entry_id = entry_id
        self.job_id = job_id


class Executor:
    """
    Executes python-plane LangGraph nodes pulled from Redis Streams.

    Its behavior mirrors the Node.js executor: poll, validate, execute, then
    either complete the job or hand off the updated graph back to the control plane.
    """

    def __init__(
        self,
        bridge: RedisBridge,
        task_registry: Mapping[str, WorkerTask],
        *,
        batch_size: int = 1,
        poll_interval: float = 0.5,
        block_ms: int = 200,
    ):
        self.bridge = bridge
        self.task_registry = task_registry
        self.batch_size = batch_size
        self.poll_interval = poll_interval
        self.block_ms = block_ms
        self.metrics = {
            "worker_active_tasks": get_or_create_metric(
                "worker_active_tasks",
                MetricType.GAUGE,
                "Number of tasks currently executing",
            ),
            "worker_jobs_total": get_or_create_metric(
                "worker_jobs_total",
                MetricType.COUNTER,
                "Total jobs seen by the worker",
                labelnames=["type"],
            ),
            "worker_job_duration_seconds": get_or_create_metric(
                "worker_job_duration_seconds",
                MetricType.HISTOGRAM,
                "Job execution time in seconds",
                labelnames=["type"],
                buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, float("inf")),
            ),
            "worker_loop_iterations_total": get_or_create_metric(
                "worker_loop_iterations_total",
                MetricType.COUNTER,
                "Number of polling loop iterations",
            ),
        }
        self.stop_event = asyncio.Event()
        self.runner: Optional[asyncio.Task] = None
        self.handler_arity: Dict[str, int] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        if self.runner:
            return
        self.stop_event.clear()
        self.runner = asyncio.create_task(self._run_loop(), name="executor-loop")

    async def stop(self) -> None:
        if not self.runner:
            return
        self.stop_event.set()
        self.runner.cancel()
        with suppress(asyncio.CancelledError):
            await self.runner
        self.runner = None

    # ------------------------------------------------------------------
    # Main polling loop
    # ------------------------------------------------------------------

    async def _run_loop(self) -> None:
        print("[Executor] 🚀 Starting python-plane executor loop...")

        while not self.stop_event.is_set():

            loop_metric = self.metrics.get("worker_loop_iterations_total")
            if loop_metric:
                loop_metric.inc()

            job = await self.bridge.poll_job(timeout=self.block_ms)
            if job is None:
                await asyncio.sleep(self.poll_interval)
                continue

            try:
                result = await self._process_job(job)
                status = result.status

                if status == "completed":
                    await self.bridge.ack_job(result.entry_id)
                    await self.bridge.publish_status(result.job_id, JobStatus.completed)
                elif status == "handoff":
                    await self.bridge.ack_job(result.entry_id)
                    await self.bridge.enqueue_control_job(
                        result.job_id, self._serialize_graph(result.graph)
                    )
                elif status == "failed":
                    await self.bridge.ack_job(result.entry_id)
                    await self.bridge.publish_status(result.job_id, JobStatus.failed)
                else:
                    print(
                        f"[Executor] ⚠️ Unknown execution status '{status}' "
                        f"for job {result.job_id}; leaving entry pending."
                    )
            except ExecutorJobError as exc:
                await self.bridge.ack_job(exc.entry_id)
                if exc.job_id:
                    await self.bridge.publish_status(result.job_id, JobStatus.failed)
                print(f"[Executor] ❌ Job error ({exc.job_id}): {exc}")

        print("[Executor] 💤 Executor loop stopped.")

    # ------------------------------------------------------------------
    # Job processing
    # ------------------------------------------------------------------

    async def _process_job(self, entry: Dict[str, Any]) -> ExecutorResult:
        entry_id = entry["xid"]
        fields = entry["fields"]
        job_id = fields.get("jobId")
        payload = fields.get("graph")

        if not job_id or not payload:
            raise ExecutorJobError("Missing jobId or payload", entry_id, job_id)

        if isinstance(payload, str):
            try:
                raw_graph = json.loads(payload)
            except json.JSONDecodeError as exc:
                raise ExecutorJobError(
                    f"Invalid graph payload: {exc}", entry_id, job_id
                ) from exc
        else:
            raw_graph = payload

        try:
            workflow = LanggraphWorkflow.model_validate(raw_graph)
        except ValidationError as exc:
            raise ExecutorJobError(f"Graph validation failed: {exc}", entry_id, job_id)

        graph = workflow.model_dump(mode="python", by_alias=True)

        if graph["workflowId"] != job_id:
            raise ExecutorJobError(
                f"Invalid job: graph workflow id ({graph["workflowId"]}) does not match job id ({job_id}).",
                entry_id,
                job_id,
            )

        await self.bridge.publish_status(job_id, JobStatus.running)

        try:
            status = await self.execute_graph(graph)
            await self.bridge.set_job_payload(job_id, self._serialize_graph(graph))
        except RuntimeError as err:
            raise ExecutorJobError(f"Failed to process graph: {err}", entry_id, job_id)

        return ExecutorResult(job_id, entry_id, graph, status)

    async def execute_graph(self, graph: Dict[str, Any]) -> str:
        ready_nodes = self._get_ready_nodes(graph)

        while ready_nodes:
            for node in ready_nodes:
                await self._execute_node(graph, node)
            ready_nodes = self._get_ready_nodes(graph)

        is_graph_completed = all(
            node.get("status") == NodeStatus.completed
            for node in graph.get("nodes", [])
        )

        is_graph_failed = any(
            node.get("status") == NodeStatus.failed for node in graph.get("nodes", [])
        )

        if is_graph_failed:
            return "failed"
        elif is_graph_completed:
            return "completed"

        return "handoff"

    async def _execute_node(self, graph: Dict[str, Any], node: Dict[str, Any]) -> None:
        task_name: str = node.get("task", "")
        handler = self.task_registry.get(task_name)
        node["status"] = NodeStatus.running
        self._metrics_inc("worker_active_tasks")
        self._metrics_inc_counter("worker_jobs_total", task_name)
        timer = self._metrics_timer("worker_job_duration_seconds", task_name)
        job_id = graph["workflowId"]
        try:
            if not handler:
                raise RuntimeError(f"No handler registered for task '{task_name}'")
            node["output"] = await handler(
                {
                    **(node.get("params") or {}),
                    "progress_weight": node.get("progressWeight") or 0,
                    "publish_progress_cb": lambda step: self.bridge.publish_progress(
                        job_id, step, False
                    ),
                    "publish_data_cb": lambda data: self.bridge.publish_data(
                        job_id, data
                    ),
                },
                {**(node.get("input") or {})},
            )
            node["status"] = NodeStatus.completed
        except Exception as exc:
            node["status"] = NodeStatus.failed
            node["error"] = {"message": str(exc)}
            print(f"[Executor] ❌ Node {task_name} failed for job {job_id}: {exc}")
        finally:
            if timer:
                timer.__exit__(None, None, None)
            self._metrics_dec("worker_active_tasks")
            await self.bridge.set_job_payload(job_id, self._serialize_graph(graph))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_ready_nodes(self, graph: Dict[str, Any]) -> List[Dict[str, Any]]:
        nodes = graph.get("nodes", [])
        nodes_by_id = {node["id"]: node for node in nodes if "id" in node}
        incoming: Dict[str, List[str]] = {}
        for edge in graph.get("edges", []):
            src = edge.get("from") or edge.get("from_")
            dst = edge.get("to")
            if not src or not dst:
                continue
            incoming.setdefault(dst, []).append(src)

        ready_nodes = []
        for node in nodes:
            if node.get("plane") != Plane.python:
                continue
            if node.get("status") in {
                NodeStatus.completed,
                NodeStatus.running,
                NodeStatus.failed,
                NodeStatus.skipped,
            }:
                continue
            deps = incoming.get(node.get("id"), [])
            if all(
                nodes_by_id.get(dep, {}).get("status") == NodeStatus.completed
                for dep in deps
            ):
                ready_nodes.append(node)

        for node in ready_nodes:
            for depId in incoming.get(node.get("id"), []):
                node["input"] = {
                    **(node.get("input") or {}),
                    **(nodes_by_id[depId].get("output") or {}),
                }

        return ready_nodes

    # ------------------------------------------------------------------
    # Metrics helpers
    # ------------------------------------------------------------------

    def _metrics_inc(self, name: str) -> None:
        metric = self.metrics.get(name)
        if metric:
            metric.inc()

    def _metrics_dec(self, name: str) -> None:
        metric = self.metrics.get(name)
        if metric:
            metric.dec()

    def _metrics_inc_counter(self, name: str, label: str) -> None:
        metric = self.metrics.get(name)
        if metric:
            metric.labels(type=label).inc()

    def _metrics_timer(self, name: str, label: str):
        metric = self.metrics.get(name)
        if metric:
            timer = metric.labels(type=label).time()
            timer.__enter__()
            return timer
        return None

    # ------------------------------------------------------------------
    # Graph serialization helpers
    # ------------------------------------------------------------------

    def _serialize_graph(self, graph: Dict[str, Any]) -> Dict[str, Any]:
        """Return a JSON-serializable copy of the graph."""

        return self._convert_value(graph)

    def _convert_value(self, value: Any) -> Any:
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, dict):
            return {k: self._convert_value(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._convert_value(item) for item in value]
        return value
