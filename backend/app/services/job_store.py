"""Small durable SQLite store for Phase 2 job state.

This is intentionally boring. It gives the API a process-restart-safe job
record without introducing a second service. Production deployments should
point ``DELTAZERO_JOB_STORE_PATH`` at a persistent volume or replace this
adapter with Postgres.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from typing import Callable

from app.models.jobs import JobRecord


class JobStore:
    def __init__(self, path: str | None = None) -> None:
        self.path = path or os.getenv("DELTAZERO_JOB_STORE_PATH", "/tmp/deltazero-jobs.sqlite3")
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS agent_metrics (
                agent_id TEXT PRIMARY KEY,
                completed_jobs INTEGER NOT NULL DEFAULT 0,
                failed_jobs INTEGER NOT NULL DEFAULT 0,
                last_completed_at TEXT
            )
            """
        )
        self._connection.commit()

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT payload FROM jobs WHERE id = ?", (job_id,)
            ).fetchone()
        return JobRecord.model_validate(json.loads(row["payload"])) if row else None

    def save(self, job: JobRecord) -> JobRecord:
        payload = json.dumps(job.model_dump(mode="json"), separators=(",", ":"))
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO jobs (id, payload, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = excluded.updated_at
                """,
                (job.id, payload, job.created_at, job.updated_at),
            )
            self._connection.commit()
        return job

    def list(self, *, statuses: set[str] | None = None) -> list[JobRecord]:
        """Return stored jobs for the optional server-side Risk Guard worker."""
        with self._lock:
            rows = self._connection.execute("SELECT payload FROM jobs ORDER BY created_at DESC").fetchall()
        jobs = [JobRecord.model_validate(json.loads(row["payload"])) for row in rows]
        if statuses is None:
            return jobs
        return [job for job in jobs if job.status in statuses]

    def update(self, job_id: str, mutate: Callable[[JobRecord], JobRecord]) -> JobRecord:
        current = self.get(job_id)
        if current is None:
            raise KeyError(job_id)
        return self.save(mutate(current))

    def record_completion(self, agent_id: str, completed_at: str) -> dict[str, object]:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO agent_metrics (agent_id, completed_jobs, failed_jobs, last_completed_at)
                VALUES (?, 1, 0, ?)
                ON CONFLICT(agent_id) DO UPDATE SET
                    completed_jobs = agent_metrics.completed_jobs + 1,
                    last_completed_at = excluded.last_completed_at
                """,
                (agent_id, completed_at),
            )
            row = self._connection.execute(
                "SELECT completed_jobs, failed_jobs, last_completed_at FROM agent_metrics WHERE agent_id = ?",
                (agent_id,),
            ).fetchone()
            self._connection.commit()
        return {
            "completed_jobs": int(row["completed_jobs"]),
            "failed_jobs": int(row["failed_jobs"]),
            "last_completed_at": row["last_completed_at"],
        }

    def clear(self) -> None:
        with self._lock:
            self._connection.execute("DELETE FROM jobs")
            self._connection.execute("DELETE FROM agent_metrics")
            self._connection.commit()


_store: JobStore | None = None
_store_lock = threading.Lock()


def get_job_store() -> JobStore:
    global _store
    with _store_lock:
        if _store is None:
            _store = JobStore()
        return _store
