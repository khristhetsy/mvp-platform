"use client";

import { CheckCircle2, Pencil, MessageSquare, Paperclip, Archive, Plus, Flag } from "lucide-react";
import type { AdminTaskActivity, TaskActivityEvent } from "@/lib/admin-tasks/types";

const ICON: Record<TaskActivityEvent, typeof Plus> = {
  created: Plus,
  updated: Pencil,
  status_changed: CheckCircle2,
  priority_changed: Flag,
  attachment_added: Paperclip,
  attachment_removed: Paperclip,
  comment_added: MessageSquare,
  archived: Archive,
  reopened: CheckCircle2,
};

function describe(a: AdminTaskActivity): string {
  const p = a.payload ?? {};
  switch (a.event_type) {
    case "created": return "created this task";
    case "status_changed": return `moved status ${String(p.from ?? "?")} → ${String(p.to ?? "?")}`;
    case "priority_changed": return `changed priority ${String(p.from ?? "?")} → ${String(p.to ?? "?")}`;
    case "attachment_added": return `added attachment ${String(p.file_name ?? "")}`.trim();
    case "attachment_removed": return `removed attachment ${String(p.file_name ?? "")}`.trim();
    case "comment_added": return "commented";
    case "archived": return "archived this task";
    case "reopened": return "reopened this task";
    case "updated": default: return "updated this task";
  }
}

function when(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ActivityFeed({ activity }: { activity: AdminTaskActivity[] }) {
  if (activity.length === 0) return <p className="text-xs text-slate-400">No activity yet.</p>;
  return (
    <ul className="space-y-3">
      {activity.map((a) => {
        const Icon = ICON[a.event_type] ?? Pencil;
        return (
          <li key={a.id} className="flex gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Icon className="h-3.5 w-3.5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              {a.event_type === "comment_added" && a.comment_text ? (
                <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">{a.comment_text}</p>
              ) : (
                <p className="text-sm text-slate-700">{describe(a)}</p>
              )}
              <p className="mt-0.5 text-[11px] text-slate-400">{when(a.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
