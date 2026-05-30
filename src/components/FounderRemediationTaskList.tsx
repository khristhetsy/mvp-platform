"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RemediationTaskRecord } from "@/lib/remediation/types";

function priorityClass(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-50 text-red-800 ring-red-100";
    case "medium":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-100";
  }
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function categoryLabel(category: string) {
  return category.replaceAll("_", " ");
}

export function FounderRemediationTaskList({
  tasks,
  compact = false,
}: Readonly<{
  tasks: RemediationTaskRecord[];
  compact?: boolean;
}>) {
  const router = useRouter();
  const [rows, setRows] = useState(tasks);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTasks = rows.filter((task) => task.status !== "completed" && task.status !== "dismissed");

  async function updateStatus(taskId: string, status: RemediationTaskRecord["status"]) {
    setLoadingId(taskId);
    setError(null);

    const response = await fetch(`/api/founder/remediation/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string; task?: RemediationTaskRecord } | null;

    setLoadingId(null);

    if (!response.ok || !body?.task) {
      setError(body?.error ?? "Unable to update task.");
      return;
    }

    setRows((current) => current.map((task) => (task.id === taskId ? body.task! : task)));
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        No open remediation tasks. Your readiness profile looks strong — keep materials current as you progress.
      </p>
    );
  }

  const displayTasks = compact ? activeTasks.slice(0, 5) : rows.filter((task) => task.status !== "dismissed");

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="space-y-3">
        {displayTasks.map((task) => (
          <article
            key={task.id}
            className={`rounded-2xl border border-slate-200 bg-white p-4 ${task.status === "completed" ? "opacity-70" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${priorityClass(task.priority)}`}>
                    {task.priority}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {categoryLabel(task.category)}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {statusLabel(task.status)}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-950">{task.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{task.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">Recommended:</span> {task.recommended_action}
                </p>
              </div>
            </div>

            {task.status !== "completed" && task.status !== "dismissed" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {task.related_feature ? (
                  <Link
                    href={task.related_feature}
                    className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Go to action
                  </Link>
                ) : null}
                {task.status === "open" ? (
                  <button
                    type="button"
                    className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    disabled={loadingId === task.id}
                    onClick={() => updateStatus(task.id, "in_progress")}
                  >
                    Mark in progress
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-full border border-emerald-300 px-4 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50"
                  disabled={loadingId === task.id}
                  onClick={() => updateStatus(task.id, "completed")}
                >
                  Mark complete
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 disabled:opacity-50"
                  disabled={loadingId === task.id}
                  onClick={() => updateStatus(task.id, "dismissed")}
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {compact && activeTasks.length > 5 ? (
        <p className="text-xs text-slate-500">{activeTasks.length - 5} more tasks on the readiness page.</p>
      ) : null}
    </div>
  );
}
