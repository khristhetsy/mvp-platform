"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupportAttachment } from "@/lib/support/support";
import type { SupportEventRow } from "@/lib/support/events";
import type { TicketContext } from "@/lib/support/ticket-context";
import type { SupportGuide } from "@/lib/support/guides";
import type { SavedReply } from "@/lib/support/saved-replies";
import { formatSupportTime, dueLabel } from "@/lib/support/business-hours";
import { STATUS_LABEL, type QueueRow, type StaffOption } from "./SupportQueueClient";
import { SupportAttachments } from "@/components/support/SupportAttachments";

type Message = {
  id: string;
  author_role: "founder" | "staff";
  author_user_id: string | null;
  body: string;
  created_at: string;
  is_internal?: boolean;
  attachments?: SupportAttachment[] | null;
};

// Activity worth seeing inline in the conversation. "Show all activity" adds the rest.
const INLINE_KINDS = new Set([
  "ai_triage",
  "ai_handoff",
  "assigned",
  "reassigned",
  "reminder",
  "due_soon",
  "overdue",
  "resolved",
  "founder_reopened",
  "founder_confirmed",
  "rated",
]);
// Already shown as messages, so never repeated as activity lines.
const MESSAGE_KINDS = new Set(["internal_note", "staff_reply", "founder_reply", "submitted"]);
const EVENT_ICON: Record<string, string> = {
  ai_triage: "ti-sparkles",
  ai_handoff: "ti-robot",
  assigned: "ti-user-check",
  reassigned: "ti-arrows-exchange",
  reminder: "ti-alarm",
  due_soon: "ti-clock-hour-4",
  overdue: "ti-alert-triangle",
  resolved: "ti-circle-check",
  founder_reopened: "ti-refresh",
  founder_confirmed: "ti-thumb-up",
  rated: "ti-star",
  status_changed: "ti-adjustments",
  priority_changed: "ti-flag",
};

function short(iso: string): string {
  return formatSupportTime(iso).replace(/^\w+, /, "");
}

export function SupportTicketView({
  row,
  staff,
  currentStaffId,
  aiDrafts,
  onChanged,
}: Readonly<{
  row: QueueRow;
  staff: StaffOption[];
  currentStaffId: string;
  aiDrafts: boolean;
  onChanged: () => void;
}>) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<SupportEventRow[]>([]);
  const [context, setContext] = useState<TicketContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActivity, setShowActivity] = useState(false);

  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [files, setFiles] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [resolveAfter, setResolveAfter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestTried, setSuggestTried] = useState(false);

  const [saved, setSaved] = useState<SavedReply[] | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [manageSaved, setManageSaved] = useState(false);

  const [resolving, setResolving] = useState(false);
  const [summary, setSummary] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/support/${row.id}`);
      if (res.ok) {
        const json = await res.json();
        setMessages(json.messages ?? []);
        setEvents(json.events ?? []);
        setContext(json.context ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [row.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const suggest = useCallback(
    async (tone?: "shorter" | "friendlier", base?: string) => {
      setSuggesting(true);
      try {
        const res = await fetch(`/api/admin/support/${row.id}/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tone ? { tone, base: base ?? "" } : { auto: true }),
        });
        const json = await res.json().catch(() => ({}));
        if (!json.unavailable && json.draft) setSuggestion(json.draft as string);
      } catch {
        /* the composer still works without a suggestion */
      } finally {
        setSuggesting(false);
        setSuggestTried(true);
      }
    },
    [row.id],
  );

  // Suggested reply: made when the ticket opens if the founder spoke last. Cached server side.
  const lastPublic = messages.filter((m) => !m.is_internal).at(-1);
  const wantsSuggestion = aiDrafts && !loading && row.status !== "resolved" && lastPublic?.author_role === "founder";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one suggestion fetch when the thread is ready
    if (wantsSuggestion && !suggestTried) void suggest();
  }, [wantsSuggestion, suggestTried, suggest]);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "That didn't go through. Try again.");
        return false;
      }
      onChanged();
      await load();
      return true;
    } catch {
      setError("Couldn't reach the server. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    const ok = await patch(
      mode === "note"
        ? { action: "note", body, attachments: files }
        : { action: "reply", body, aiDraft, attachments: files, resolveAfter },
    );
    if (ok) {
      setText("");
      setAiDraft(null);
      setFiles([]);
      setResolveAfter(false);
      if (mode === "reply") setSuggestion(null);
    }
  }

  async function attach(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/support/${row.id}/attachments`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.attachment) setError(json.error ?? "Couldn't attach that file.");
      else setFiles((f) => [...f, json.attachment as SupportAttachment]);
    } catch {
      setError("Couldn't attach that file.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function toggleSaved() {
    setSavedOpen((o) => !o);
    if (saved === null) {
      const res = await fetch("/api/admin/support/saved-replies").catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      setSaved((json.replies as SavedReply[] | undefined) ?? []);
    }
  }

  async function draftSummary() {
    setSummarizing(true);
    try {
      const res = await fetch(`/api/admin/support/${row.id}/summary`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (json.summary) {
        setSummary(json.summary);
        setAiSummary(json.summary);
      } else setError("AI summaries aren't available right now. Write the summary directly.");
    } finally {
      setSummarizing(false);
    }
  }

  // Conversation and inline activity, in time order.
  type Item = { at: string; m?: Message; e?: SupportEventRow };
  const extraEvents = events.filter((e) => !MESSAGE_KINDS.has(e.kind) && !INLINE_KINDS.has(e.kind));
  const items: Item[] = [
    ...messages.map((m) => ({ at: m.created_at, m })),
    ...events
      .filter((e) => !MESSAGE_KINDS.has(e.kind) && (showActivity || INLINE_KINDS.has(e.kind)))
      .map((e) => ({ at: e.created_at, e })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const staffName = (id: string | null) => (id === currentStaffId ? "You" : staff.find((s) => s.id === id)?.name ?? "Staff");
  const due = row.status === "open" ? dueLabel(row.dueAt) : null;
  const channelLabel = row.channel === "email" ? "Email" : row.channel === "chat" ? "Chat handoff" : "In-app request";
  const open = row.status !== "resolved";

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
      {/* Conversation */}
      <div className="flex min-h-[560px] min-w-0 flex-col rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{row.subject}</p>
              <p className="truncate text-[11px] text-slate-500">
                {row.refNo ? `#${row.refNo} · ` : ""}
                {row.founderName} · {row.companyName} · {channelLabel}
                {row.reopenedCount ? ` · reopened ${row.reopenedCount}x` : ""}
              </p>
            </div>
            {due ? (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${due.overdue ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                {due.text}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.assignedTo !== currentStaffId && open ? (
              <QuickButton icon="ti-user-check" label="Assign to me" disabled={busy} onClick={() => patch({ action: "assign", assigneeId: currentStaffId })} />
            ) : null}
            {row.status === "open" ? (
              <QuickButton icon="ti-hourglass" label="Waiting on founder" disabled={busy} onClick={() => patch({ action: "status", status: "pending_founder" })} />
            ) : row.status === "pending_founder" ? (
              <QuickButton icon="ti-inbox" label="Mark open" disabled={busy} onClick={() => patch({ action: "status", status: "open" })} />
            ) : null}
            {open ? (
              <QuickButton icon="ti-circle-check" label="Resolve" tone="emerald" disabled={busy || resolving} onClick={() => setResolving(true)} />
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Resolved</span>
            )}
          </div>
        </div>

        {resolving && open ? (
          <div className="mx-3 mt-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-xs font-semibold text-emerald-800">Resolve and ask the founder &ldquo;Did this solve your issue?&rdquo;</p>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Summary for the founder: what was done (optional)"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
              {aiDrafts ? (
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
                onClick={async () => {
                  if (await patch({ action: "resolve", summary: summary.trim() || null, aiSummary })) {
                    setResolving(false);
                    setSummary("");
                    setAiSummary(null);
                  }
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? "Resolving…" : "Resolve and send"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Thread */}
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {row.aiTriage ? (
            <button
              type="button"
              onClick={() => setTriageOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-1.5 text-left text-[11px] text-indigo-700"
            >
              <i className="ti ti-sparkles" aria-hidden="true" />
              <span className="flex-1">
                AI triage: {row.aiTriage.topic}, {row.aiTriage.priority} priority,{" "}
                {row.aiTriage.canAiAnswer ? "a how-to the AI can answer" : "needs a person"}
              </span>
              <span className="text-[10px] text-indigo-400">Internal</span>
            </button>
          ) : null}
          {triageOpen && row.aiTriage?.reason ? <p className="px-3 text-[11px] text-slate-500">{row.aiTriage.reason}</p> : null}

          {loading ? (
            <p className="text-xs text-slate-400">Loading the conversation…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-400">No messages yet.</p>
          ) : (
            items.map((it) =>
              it.m ? (
                <MessageBubble key={it.m.id} m={it.m} who={it.m.author_role === "founder" ? row.founderName : staffName(it.m.author_user_id)} />
              ) : it.e ? (
                <div key={it.e.id} className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
                  <i className={`ti ${EVENT_ICON[it.e.kind] ?? "ti-point"}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{it.e.summary}</span>
                  <span className="shrink-0">{short(it.e.created_at)}</span>
                </div>
              ) : null,
            )
          )}
          {extraEvents.length > 0 ? (
            <button type="button" onClick={() => setShowActivity((s) => !s)} className="px-1 text-[11px] font-medium text-indigo-600 hover:underline">
              {showActivity ? "Hide extra activity" : `Show all activity (${extraEvents.length} more)`}
            </button>
          ) : null}
        </div>

        {/* Suggested reply */}
        {open && mode === "reply" && (suggesting || suggestion) ? (
          <div className="mx-3 mb-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
              <i className="ti ti-sparkles" aria-hidden="true" /> Suggested reply
              <span className="ml-auto font-normal text-indigo-400">Check it before sending</span>
            </p>
            {suggesting && !suggestion ? (
              <p className="mt-1.5 text-xs text-slate-500">Writing a suggestion…</p>
            ) : (
              <>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-snug text-slate-800">{suggestion}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setText(suggestion ?? "");
                      setAiDraft(suggestion);
                    }}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Use this
                  </button>
                  <button
                    type="button"
                    disabled={suggesting}
                    onClick={() => suggest("shorter", suggestion ?? "")}
                    className="rounded-lg border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  >
                    Shorter
                  </button>
                  <button
                    type="button"
                    disabled={suggesting}
                    onClick={() => suggest("friendlier", suggestion ?? "")}
                    className="rounded-lg border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  >
                    Friendlier
                  </button>
                  <button type="button" onClick={() => setSuggestion(null)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
                    Dismiss
                  </button>
                  {suggesting ? <span className="self-center text-[11px] text-slate-400">Rewriting…</span> : null}
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* Composer */}
        {open ? (
          <div className="border-t border-slate-100 p-3">
            <div className="mb-2 flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setMode("reply")}
                className={`rounded-lg px-3 py-1 font-medium ${mode === "reply" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Reply to founder
              </button>
              <button
                type="button"
                onClick={() => setMode("note")}
                className={`rounded-lg px-3 py-1 font-medium ${mode === "note" ? "bg-amber-400 text-amber-950" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <i className="ti ti-lock" aria-hidden="true" /> Internal note
              </button>
              {aiDrafts && mode === "reply" && !suggestion && !suggesting ? (
                <button
                  type="button"
                  onClick={() => suggest()}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-indigo-600 hover:bg-indigo-50"
                >
                  <i className="ti ti-sparkles" aria-hidden="true" /> Suggest a reply
                </button>
              ) : null}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder={mode === "note" ? "Only staff can see internal notes." : `Write to ${row.founderName}…`}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${mode === "note" ? "border-amber-200 bg-amber-50/60 focus:border-amber-400" : "border-slate-200 focus:border-indigo-400"}`}
            />
            {files.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {files.map((f) => (
                  <span key={f.path} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                    <i className="ti ti-file-type-pdf text-red-500" aria-hidden="true" /> {f.name}
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles((x) => x.filter((y) => y.path !== f.path))}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
            <div className="relative mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={toggleSaved} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                <i className="ti ti-bookmark" aria-hidden="true" /> Saved replies
              </button>
              <button
                type="button"
                disabled={uploading || files.length >= 5}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <i className="ti ti-paperclip" aria-hidden="true" /> {uploading ? "Attaching…" : "Attach PDF"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void attach(f);
                }}
              />
              {mode === "reply" ? (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={resolveAfter} onChange={(e) => setResolveAfter(e.target.checked)} /> Resolve after sending
                </label>
              ) : null}
              <button
                type="button"
                disabled={busy || !text.trim()}
                onClick={send}
                className={`ml-auto rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-60 ${mode === "note" ? "bg-amber-400 text-amber-950 hover:bg-amber-500" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
              >
                {busy ? "Sending…" : mode === "note" ? "Add note" : "Send"}
              </button>
              {savedOpen ? (
                <div className="absolute bottom-10 left-0 z-20 w-72 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-lg">
                  {saved === null ? (
                    <p className="p-2 text-slate-400">Loading…</p>
                  ) : saved.length === 0 ? (
                    <p className="p-2 text-slate-500">No saved replies yet.</p>
                  ) : (
                    saved.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setText((t) => (t.trim() ? `${t.trim()}\n\n${s.body}` : s.body));
                          setSavedOpen(false);
                        }}
                        className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-800">{s.title}</span>
                        <span className="block truncate text-[11px] text-slate-500">{s.body}</span>
                      </button>
                    ))
                  )}
                  <div className="mt-1 border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setManageSaved(true);
                        setSavedOpen(false);
                      }}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-indigo-600 hover:bg-indigo-50"
                    >
                      <i className="ti ti-pencil" aria-hidden="true" /> Manage saved replies
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Side panel */}
      <aside className="space-y-3">
        {context ? <GuidePanel key={context.guide.topic} guide={context.guide} /> : null}

        <Panel title="Founder">
          {context ? (
            <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[11px]">
              <dt className="text-slate-500">Name</dt>
              <dd className="truncate text-slate-800">{context.founderName ?? row.founderName}</dd>
              <dt className="text-slate-500">Email</dt>
              <dd className="truncate text-slate-800">{context.founderEmail ?? "None"}</dd>
              <dt className="text-slate-500">Company</dt>
              <dd className="truncate">
                <a href={`/admin/companies/${context.companyId}`} className="text-indigo-600 hover:underline">
                  {context.companyName ?? row.companyName}
                </a>
              </dd>
              <dt className="text-slate-500">Plan</dt>
              <dd className="truncate text-slate-800">
                {context.plan ?? "None"}
                {context.planPrice ? ` · ${context.planPrice}` : ""}
              </dd>
              <dt className="text-slate-500">Stage</dt>
              <dd className="truncate text-slate-800">{context.stage ?? "None"}</dd>
              <dt className="text-slate-500">Investable</dt>
              <dd className="text-slate-800">{context.investable ?? "None"}</dd>
              <dt className="text-slate-500">Past requests</dt>
              <dd className="text-slate-800">{context.pastRequests}</dd>
            </dl>
          ) : (
            <p className="text-[11px] text-slate-400">{loading ? "Loading…" : "Not available."}</p>
          )}
        </Panel>

        <Panel title="Ticket details">
          <div className="space-y-2 text-[11px]">
            <Field label="Status">
              {open ? (
                <select
                  value={row.status}
                  disabled={busy}
                  onChange={(e) => patch({ action: "status", status: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[11px]"
                  aria-label="Status"
                >
                  <option value="open">Open</option>
                  <option value="pending_founder">Waiting on founder</option>
                </select>
              ) : (
                <span className="text-slate-800">{STATUS_LABEL.resolved}</span>
              )}
            </Field>
            <Field label="Assignee">
              <select
                value={row.assignedTo ?? ""}
                disabled={busy}
                onChange={(e) => patch({ action: "assign", assigneeId: e.target.value || null })}
                className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[11px]"
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                <option value={currentStaffId}>Me</option>
                {staff
                  .filter((s) => s.id !== currentStaffId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={row.priority}
                disabled={busy}
                onChange={(e) => patch({ action: "priority", priority: e.target.value })}
                className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[11px]"
                aria-label="Priority"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Reply due">
              <span className="text-slate-800">{row.dueAt && row.status === "open" ? formatSupportTime(row.dueAt) : "None"}</span>
            </Field>
            <Field label="Opened">
              <span className="text-slate-800">{formatSupportTime(row.createdAt)}</span>
            </Field>
            <Field label="Channel">
              <span className="text-slate-800">{channelLabel}</span>
            </Field>
            {row.contextItem ? (
              <Field label="From">
                <span className="text-slate-800">{row.contextItem}</span>
              </Field>
            ) : null}
          </div>
        </Panel>

        <Panel title="Activity">
          {events.length === 0 ? (
            <p className="text-[11px] text-slate-400">No activity yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {events
                .slice(-5)
                .reverse()
                .map((e) => (
                  <li key={e.id} className="text-[11px]">
                    <p className="truncate text-slate-700">{e.summary}</p>
                    <p className="text-[10px] text-slate-400">{short(e.created_at)}</p>
                  </li>
                ))}
            </ul>
          )}
          <a href={`/admin/support/log?request=${row.id}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline">
            <i className="ti ti-list-details" aria-hidden="true" /> Full log
          </a>
        </Panel>
      </aside>

      {manageSaved ? (
        <SavedRepliesEditor
          initial={saved ?? []}
          onClose={(next) => {
            if (next) setSaved(next);
            setManageSaved(false);
          }}
        />
      ) : null}
    </div>
  );
}

function QuickButton({ icon, label, onClick, disabled, tone }: { icon: string; label: string; onClick: () => void; disabled?: boolean; tone?: "emerald" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium disabled:opacity-60 ${tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
    >
      <i className={`ti ${icon}`} aria-hidden="true" /> {label}
    </button>
  );
}

function MessageBubble({ m, who }: { m: Message; who: string }) {
  const files = m.attachments ?? [];
  if (m.is_internal) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-amber-800">
          <i className="ti ti-lock" aria-hidden="true" /> Internal note · {who} · {short(m.created_at)}
        </p>
        <p className="whitespace-pre-wrap text-[13px] leading-snug text-amber-950">{m.body}</p>
        <SupportAttachments messageId={m.id} files={files} />
      </div>
    );
  }
  const staff = m.author_role === "staff";
  return (
    <div className={`max-w-[85%] rounded-xl px-3 py-2 ${staff ? "ml-auto border border-indigo-100 bg-indigo-50 text-slate-800" : "bg-slate-100 text-slate-800"}`}>
      <p className="whitespace-pre-wrap text-[13px] leading-snug">{m.body}</p>
      <SupportAttachments messageId={m.id} files={files} />
      <p className={`mt-1 text-[10px] ${staff ? "text-indigo-400" : "text-slate-400"}`}>
        {who} · {short(m.created_at)}
      </p>
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-2">
      <span className="text-slate-500">{label}</span>
      {children}
    </div>
  );
}

/** Step by step guide for this ticket's topic. Ticks last while the ticket is open; edits save for the whole team. */
function GuidePanel({ guide }: { guide: SupportGuide }) {
  const [current, setCurrent] = useState(guide);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(guide.steps.join("\n"));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const all = await fetch("/api/admin/support/guides")
        .then((r) => r.json())
        .catch(() => ({}));
      const guides = (all.guides ?? []) as SupportGuide[];
      const steps = draft
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15);
      const next = { ...current, steps };
      const merged = guides.some((g) => g.topic === current.topic)
        ? guides.map((g) => (g.topic === current.topic ? next : g))
        : [...guides, next];
      const res = await fetch("/api/admin/support/guides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guides: merged }),
      });
      if (!res.ok) {
        setErr("Couldn't save the guide.");
        return;
      }
      setCurrent(next);
      setDone(new Set());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title={`Guide: ${current.title}`}
      action={
        <button
          type="button"
          onClick={() => {
            setEditing((e) => !e);
            setDraft(current.steps.join("\n"));
          }}
          className="shrink-0 text-[11px] text-indigo-600 hover:underline"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      }
    >
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={7}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus:border-indigo-400 focus:outline-none"
            aria-label="Guide steps"
          />
          <p className="text-[10px] text-slate-400">One step per line. Saves for the whole team.</p>
          {err ? <p className="text-[11px] text-red-600">{err}</p> : null}
          <button type="button" disabled={saving} onClick={save} className="mt-1.5 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save guide"}
          </button>
        </div>
      ) : (
        <ol className="space-y-1.5">
          {current.steps.map((s, i) => (
            <li key={i}>
              <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={done.has(i)}
                  onChange={() =>
                    setDone((d) => {
                      const n = new Set(d);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                />
                <span className={done.has(i) ? "text-slate-400 line-through" : "text-slate-700"}>
                  <span className="font-semibold">Step {i + 1}.</span> {s}
                </span>
              </label>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function SavedRepliesEditor({ initial, onClose }: { initial: SavedReply[]; onClose: (next: SavedReply[] | null) => void }) {
  const [items, setItems] = useState<SavedReply[]>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const clean = items.map((r) => ({ ...r, title: r.title.trim(), body: r.body.trim() })).filter((r) => r.title && r.body);
      const res = await fetch("/api/admin/support/saved-replies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replies: clean }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? "Couldn't save.");
        return;
      }
      onClose((json.replies as SavedReply[] | undefined) ?? clean);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" role="dialog" aria-modal="true" aria-label="Saved replies">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center">
          <h2 className="flex-1 text-sm font-semibold text-slate-900">Saved replies</h2>
          <button type="button" onClick={() => onClose(null)} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3">
          {items.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-2.5">
              <div className="flex gap-2">
                <input
                  value={r.title}
                  onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))}
                  placeholder="Title"
                  className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
                  aria-label="Saved reply title"
                />
                <button type="button" onClick={() => setItems((x) => x.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </div>
              <textarea
                value={r.body}
                onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, body: e.target.value } : y)))}
                rows={3}
                placeholder="Reply text"
                className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                aria-label="Saved reply text"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems((x) => [...x, { id: `r${Date.now().toString(36)}`, title: "", body: "" }])}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
        >
          <i className="ti ti-plus" aria-hidden="true" /> Add saved reply
        </button>
        {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onClose(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
