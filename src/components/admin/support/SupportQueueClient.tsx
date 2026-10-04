"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SupportCareSettings } from "@/lib/support/settings";
import type { SupportAiTriage } from "@/lib/support/support";
import { dueLabel } from "@/lib/support/business-hours";
import { SupportSettingsPanel } from "./SupportSettingsPanel";

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
  // Support care
  refNo: number | null;
  dueAt: string | null;
  aiTriage: SupportAiTriage | null;
  rating: number | null;
  reopenedCount: number;
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
  showResolved = false,
  settings,
  canEditSettings = false,
}: Readonly<{
  rows: QueueRow[];
  staff: StaffOption[];
  currentStaffId: string;
  showResolved?: boolean;
  settings: SupportCareSettings;
  canEditSettings?: boolean;
}>) {
  const router = useRouter();
  const params = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Last-seen copy of the selected row, for when it drops out of `rows` (resolved while
  // "Show resolved" is off) — the thread stays open with its final status.
  const [lastRow, setLastRow] = useState<QueueRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  // The AI draft the reply started from, so the log can say whether staff edited it.
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [summary, setSummary] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  // Derive from `rows` so router.refresh() after assign / resolve is reflected here.
  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? lastRow : null;

  async function draftWithAi() {
    if (!selected) return;
    setDrafting(true);
    try {
      const res = await fetch(`/api/admin/support/${selected.id}/draft`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error ?? `Couldn't draft a reply (HTTP ${res.status}).`);
      } else if (json.unavailable) {
        alert("AI drafting isn't available right now — write your reply directly.");
      } else if (json.draft) {
        setReply(json.draft);
        setAiDraft(json.draft);
      }
    } catch {
      alert("Couldn't reach the server to draft a reply.");
    } finally {
      setDrafting(false);
    }
  }

  async function draftSummary() {
    if (!selected) return;
    setSummarizing(true);
    try {
      const res = await fetch(`/api/admin/support/${selected.id}/summary`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (json.summary) {
        setSummary(json.summary);
        setAiSummary(json.summary);
      } else {
        alert("AI summaries aren't available right now. Write the summary directly.");
      }
    } catch {
      alert("Couldn't reach the server to draft a summary.");
    } finally {
      setSummarizing(false);
    }
  }

  async function open(row: QueueRow) {
    setSelectedId(row.id);
    setLastRow(row);
    setMessages([]);
    setReply("");
    setAiDraft(null);
    setResolving(false);
    setSummary("");
    setAiSummary(null);
    const res = await fetch(`/api/admin/support/${row.id}`);
    if (res.ok) {
      const json = await res.json();
      setMessages(json.messages ?? []);
    }
  }

  // A notification deep-link (?request=<id>) lands with that request open.
  const wanted = params.get("request");
  useEffect(() => {
    if (!wanted || selectedId) return;
    const row = rows.find((r) => r.id === wanted);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open() sets state to reflect the URL, once
    if (row) void open(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per ?request
  }, [wanted, rows]);

  function toggleResolved() {
    const q = new URLSearchParams(params.toString());
    if (showResolved) q.delete("resolved"); else q.set("resolved", "1");
    const query = q.toString();
    router.push(query ? `/admin/support?${query}` : "/admin/support");
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
        setAiDraft(null);
        await open(selected);
      }
      if (body.action === "resolve") {
        setResolving(false);
        setSummary("");
        setAiSummary(null);
      }
      // Keep the open thread truthful even if the row leaves the list on refresh.
      if (body.action === "resolve") setLastRow({ ...selected, status: "resolved" });
      if (body.action === "assign") {
        const id = (body.assigneeId as string | null) ?? null;
        setLastRow({ ...selected, assignedTo: id, assigneeName: id ? (id === currentStaffId ? "You" : staff.find((s) => s.id === id)?.name ?? null) : null });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const toggle = (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={showResolved} onChange={toggleResolved} /> Show resolved
      </label>
      <a href="/admin/support/log" className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
        <i className="ti ti-list-details" aria-hidden="true" /> Support log
      </a>
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
      >
        <i className="ti ti-bell" aria-hidden="true" /> Notifications
      </button>
      {settingsOpen ? (
        <SupportSettingsPanel initial={settings} staff={staff} canEdit={canEditSettings} onClose={() => { setSettingsOpen(false); router.refresh(); }} />
      ) : null}
    </div>
  );

  if (rows.length === 0) {
    return (
      <div>
        {toggle}
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {showResolved ? "No support requests yet." : "No open support requests. Founder help requests and questions land here."}
        </div>
      </div>
    );
  }

  return (
    <div>
    {toggle}
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
                  {r.priority === "high" && r.status !== "resolved" ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Top priority</span>
                  ) : null}
                  {(() => {
                    // A promised reply time, when set, replaces the generic 24h "At risk".
                    const due = r.status === "open" ? dueLabel(r.dueAt) : null;
                    if (due) {
                      return (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${due.overdue ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                          {due.text}
                        </span>
                      );
                    }
                    const sla = slaLabel(r.createdAt, r.status);
                    return sla.atRisk ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">At risk</span>
                    ) : null;
                  })()}
                  {r.rating ? <span className="text-[11px] text-amber-500" title="Founder rating">{"★".repeat(r.rating)}</span> : null}
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
                <p className="truncate text-xs text-slate-500">
                  {selected.refNo ? `#${selected.refNo} · ` : ""}{selected.companyName} · {selected.founderName}
                  {selected.reopenedCount ? ` · reopened ${selected.reopenedCount}x` : ""}
                </p>
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
                  onClick={() => setResolving(true)}
                  disabled={busy || resolving}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  Resolve
                </button>
              ) : null}
            </div>

            {selected.aiTriage ? (
              <div className="mx-4 mt-4 rounded-lg border border-indigo-200 bg-white p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                  <i className="ti ti-sparkles" aria-hidden="true" /> AI triage
                  <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">Internal only</span>
                </p>
                <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-slate-500">Topic</dt>
                  <dd className="text-slate-800">{selected.aiTriage.topic}</dd>
                  <dt className="text-slate-500">Priority</dt>
                  <dd className="capitalize text-slate-800">{selected.aiTriage.priority}</dd>
                  <dt className="text-slate-500">AI can answer?</dt>
                  <dd>
                    {selected.aiTriage.canAiAnswer ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Yes, how-to</span>
                    ) : (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">No, needs a person</span>
                    )}
                  </dd>
                </dl>
                {selected.aiTriage.reason ? <p className="mt-1.5 text-[11px] text-slate-400">{selected.aiTriage.reason}</p> : null}
              </div>
            ) : null}

            {resolving && selected.status !== "resolved" ? (
              <div className="mx-4 mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                <p className="text-xs font-semibold text-emerald-800">Resolve and ask the founder &ldquo;Did this solve your issue?&rdquo;</p>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  placeholder="Summary for the founder: what was done (optional)"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                  {settings.ai.drafts ? (
                    <button
                      type="button"
                      disabled={summarizing}
                      onClick={draftSummary}
                      className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                    >
                      <i className="ti ti-sparkles" aria-hidden="true" /> {summarizing ? "Drafting…" : "Draft summary with AI"}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setResolving(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act({ action: "resolve", summary: summary.trim() || null, aiSummary })}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {busy ? "Resolving…" : "Resolve and send"}
                  </button>
                </div>
              </div>
            ) : null}

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
                  onClick={() => act({ action: "reply", body: reply.trim(), aiDraft })}
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
    </div>
  );
}
