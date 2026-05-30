"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ComplianceEventRecord } from "@/lib/compliance/types";

export function AdminComplianceQueue({
  events,
  title,
}: Readonly<{
  events: ComplianceEventRecord[];
  title: string;
}>) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function runAction(eventId: string, action: "review" | "dismiss" | "resolve" | "escalate") {
    setLoadingId(eventId);
    const response = await fetch(`/api/admin/compliance/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        internalNotes: notes[eventId] || undefined,
        severity: action === "escalate" ? "critical" : undefined,
      }),
    });
    setLoadingId(null);
    if (!response.ok) {
      return;
    }
    router.refresh();
  }

  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No events in this section.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {events.map((event) => (
        <div key={event.id} className="rounded-xl border border-slate-200 p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{event.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {event.severity} · {event.event_type} · {event.source} · {new Date(event.created_at).toLocaleString()}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {event.status}
            </span>
          </div>
          <p className="mt-2 text-slate-700">{event.description}</p>
          {event.internal_notes ? (
            <p className="mt-2 text-xs text-slate-500">Notes: {event.internal_notes}</p>
          ) : null}
          <textarea
            value={notes[event.id] ?? ""}
            onChange={(e) => setNotes((prev) => ({ ...prev, [event.id]: e.target.value }))}
            placeholder="Internal notes (staff only)"
            rows={2}
            className="mt-3 w-full rounded-lg border px-2 py-1 text-xs"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loadingId === event.id}
              onClick={() => void runAction(event.id, "review")}
              className="rounded border px-2 py-0.5 text-xs"
            >
              Mark reviewed
            </button>
            <button
              type="button"
              disabled={loadingId === event.id}
              onClick={() => void runAction(event.id, "resolve")}
              className="rounded border px-2 py-0.5 text-xs"
            >
              Resolve
            </button>
            <button
              type="button"
              disabled={loadingId === event.id}
              onClick={() => void runAction(event.id, "dismiss")}
              className="rounded border px-2 py-0.5 text-xs text-slate-600"
            >
              Dismiss
            </button>
            <button
              type="button"
              disabled={loadingId === event.id}
              onClick={() => void runAction(event.id, "escalate")}
              className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800"
            >
              Escalate
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
