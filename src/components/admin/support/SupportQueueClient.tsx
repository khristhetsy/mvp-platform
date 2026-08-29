"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type QueueRow = {
  id: string;
  subject: string;
  status: string;
  source: string;
  priority: string;
  contextStage: string | null;
  contextItem: string | null;
  companyId: string;
  companyName: string;
  founderName: string;
  assignedTo: string | null;
  assigneeName: string | null;
  csat: number | null;
  createdAt: string;
};

export type StaffOption = { id: string; name: string };

type Message = { id: string; author_role: "founder" | "staff"; body: string; created_at: string };

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-50 text-amber-700",
  pending_founder: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  pending_founder: "Waiting on founder",
  resolved: "Resolved",
};

// Time-open + at-risk (open and unanswered past ~24h). No SLA table — derived
// from created_at so the queue surfaces what's aging.
function slaLabel(createdAt: string, status: string): { text: string; atRisk: boolean } {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / (60 * 60 * 1000));
  const text = hours < 1 ? "just now" : hours < 24 ? `${hours}h open` : `${Math.floor(hours / 24)}d open`;
  return { text, atRisk: status === "open" && hours >= 24 };
}

export function SupportQueueClient({
  rows,
  staff,
  currentStaffId,
}: Readonly<{ rows: QueueRow[]; staff: StaffOption[]; currentStaffId: string }>) {
  const router = useRouter();
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);

  async function draftWithAi() {
    if (!selected) return;
    setDrafting(true);
    try {
      const res = await fetch(`/api/admin/support/${selected.id}/draft`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (json.unavailable) {
        alert("AI drafting isn't available right now — write your reply directly.");
      } else if (json.draft) {
        setReply(json.draft);
      }
    } finally {
      setDrafting(false);
    }
  }

  async function open(row: QueueRow) {
    setSelected(row);
    setMessages([]);
    setReply("");
    const res = await fetch(`/api/admin/support/${row.id}`);
    if (res.ok) {
      const json = await res.json();
      setMessages(json.messages ?? []);
    }
  }

  async function act(body: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/support/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Action failed.");
        return;
      }
      if (body.action === "reply") {
        setReply("");
        await open(selected);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No open support requests. Founder help requests and questions land here.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
      {/* Queue list */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => open(r)}
                className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${selected?.id === r.id ? "bg-indigo-50/60" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{r.subject}</span>
                  {(() => {
                    const sla = slaLabel(r.createdAt, r.status);
                    return sla.atRisk ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">At risk</span>
                    ) : null;
                  })()}
                  {r.csat ? <span className="text-[11px]" title="Founder rating">{r.csat === 1 ? "👍" : "👎"}</span> : null}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {r.companyName} · {r.founderName}
                  {r.contextItem ? ` · ${r.contextItem}` : ""}
                  {r.assigneeName ? ` · ${r.assigneeName}` : " · unassigned"} · {slaLabel(r.createdAt, r.status).text}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Thread + actions */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {!selected ? (
          <div className="p-6 text-sm text-slate-500">Select a request to view the conversation.</div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{selected.subject}</p>
                <p className="truncate text-xs text-slate-500">{selected.companyName} · {selected.founderName}</p>
              </div>
              <select
                value={selected.assignedTo ?? ""}
                onChange={(e) => act({ action: "assign", assigneeId: e.target.value || null })}
                disabled={busy}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                aria-label="Assign to"
              >
                <option value="">Unassigned</option>
                <option value={currentStaffId}>Assign to me</option>
                {staff.filter((s) => s.id !== currentStaffId).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {selected.status !== "resolved" ? (
                <button
                  type="button"
                  onClick={() => act({ action: "resolve" })}
                  disabled={busy}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  Resolve
                </button>
              ) : null}
            </div>

            <div className="flex-1 space-y-2 p-4">
              {messages.length === 0 ? (
                <p className="text-xs text-slate-400">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${m.author_role === "staff" ? "ml-auto bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                    <p className="text-[13px] leading-snug">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${m.author_role === "staff" ? "text-indigo-200" : "text-slate-400"}`}>
                      {m.author_role === "staff" ? "You / staff" : "Founder"} · {new Date(m.created_at).toLocaleString("en-US")}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 p-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder="Write a reply to the founder…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={drafting}
                  onClick={draftWithAi}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                >
                  <i className="ti ti-sparkles" aria-hidden="true" /> {drafting ? "Drafting…" : "Draft with AI"}
                </button>
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() => act({ action: "reply", body: reply.trim() })}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send reply"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
