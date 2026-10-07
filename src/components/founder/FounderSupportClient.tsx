"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SupportAttachment } from "@/lib/support/support";
import { formatSupportTime } from "@/lib/support/business-hours";
import { SupportAttachments } from "@/components/support/SupportAttachments";

export type FounderRequestRow = {
  id: string;
  subject: string;
  status: string;
  contextItem: string | null;
  csat: number | null;
  createdAt: string;
  // Support care
  refNo: number | null;
  ownerId: string | null;
  ownerName: string | null;
  dueAt: string | null;
  resolutionSummary: string | null;
  rating: number | null;
  closedAt: string | null;
};

type Message = {
  id: string;
  author_role: "founder" | "staff";
  body: string;
  created_at: string;
  attachments?: SupportAttachment[] | null;
};

// "Open your Financial model": the screen the request came from.
const TOOL_LINKS: Record<string, string> = {
  "financial model": "/founder/financial-model",
  "cap table": "/founder/cap-table",
  "business plan": "/founder/business-plan",
  "pitch deck": "/founder/pitch-deck",
  "data room": "/founder/documents",
  documents: "/founder/documents",
  billing: "/founder/settings/billing",
  valuation: "/founder/valuation",
  "investor pipeline": "/founder/investor-pipeline",
  "deal room": "/founder/deal-room",
};
function toolLink(item: string | null): { href: string; label: string } | null {
  if (!item) return null;
  const href = TOOL_LINKS[item.trim().toLowerCase()];
  return href ? { href, label: item.trim() } : null;
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-50 text-amber-700",
  pending_founder: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
};
const STATUS_LABEL: Record<string, string> = {
  open: "In progress",
  pending_founder: "Waiting on you",
  resolved: "Resolved",
};

const initials = (name: string | null) =>
  (name ?? "iCapOS").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const when = (iso: string) => formatSupportTime(iso);

function Tracker({ row, hasStaffReply }: Readonly<{ row: FounderRequestRow; hasStaffReply: boolean }>) {
  const steps = [
    { label: "Received", done: true },
    { label: "Assigned", done: Boolean(row.ownerId) },
    { label: "In progress", done: row.status === "resolved" || hasStaffReply },
    { label: "Resolved", done: row.status === "resolved" },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="flex items-start" aria-label="Request progress">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
          {i < steps.length - 1 ? (
            <span className={`absolute left-1/2 top-[11px] h-0.5 w-full ${s.done && steps[i + 1].done ? "bg-emerald-500" : "bg-slate-200"}`} aria-hidden="true" />
          ) : null}
          <span
            className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
              s.done ? "border-emerald-500 bg-emerald-500 text-white" : i === current ? "border-indigo-500 bg-white text-indigo-600" : "border-slate-200 bg-white text-slate-400"
            }`}
          >
            {s.done ? <i className="ti ti-check text-[13px]" aria-hidden="true" /> : i + 1}
          </span>
          <span className={`mt-1 text-[11px] ${s.done || i === current ? "font-medium text-slate-800" : "text-slate-400"}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function FounderSupportClient({ rows, emailReplies = false }: Readonly<{ rows: FounderRequestRow[]; emailReplies?: boolean }>) {
  const router = useRouter();
  const params = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  // Read the selected row off `rows` (server data) so a refresh — e.g. after staff resolve —
  // updates status / CSAT here instead of leaving a stale copy in state.
  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  async function open(row: FounderRequestRow) {
    setSelectedId(row.id);
    setMessages([]);
    setReply("");
    setFiles([]);
    setRating(0);
    setComment("");
    setRated(false);
    setError(null);
    const res = await fetch(`/api/founder/support/${row.id}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open is stable for our purposes; run once per ?request
  }, [wanted, rows]);

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/founder/support/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim(), attachments: files }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Couldn't send. Try again.");
      } else {
        setReply("");
        setFiles([]);
        await open(selected);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function attach(file: File) {
    if (!selected) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/founder/support/${selected.id}/attachments`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.attachment) setError(json.error ?? "Couldn't attach that file. PDFs up to 10 MB.");
      else setFiles((f) => [...f, json.attachment as SupportAttachment]);
    } catch {
      setError("Couldn't attach that file.");
    } finally {
      setUploading(false);
    }
  }

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    if (!selected) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/founder/support/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Couldn't save. Try again.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function sendRating() {
    if (!rating) {
      setError("Pick a rating first.");
      return;
    }
    if (await patch({ rating, comment: comment.trim() || null })) setRated(true);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No support requests yet. Use the &ldquo;Request help&rdquo; button on any screen when you&apos;re stuck.
      </div>
    );
  }

  const hasStaffReply = messages.some((m) => m.author_role === "staff");
  const awaitingAnswer = selected?.status === "resolved" && selected.csat == null && !selected.closedAt;
  const askRating = selected?.status === "resolved" && selected.csat === 1 && selected.rating == null && !rated;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => open(r)} className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${selected?.id === r.id ? "bg-indigo-50/60" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{r.subject}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {r.refNo ? `#${r.refNo} · ` : ""}
                  {r.ownerName ? `${r.ownerName} · ` : ""}
                  {r.contextItem ?? new Date(r.createdAt).toLocaleDateString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {!selected ? (
          <div className="p-6 text-sm text-slate-500">Select a request to view the conversation.</div>
        ) : (
          <div className="flex flex-col">
            <div className="space-y-4 border-b border-slate-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{selected.subject}</p>
                  <p className="text-xs text-slate-500">
                    {selected.refNo ? `Request #${selected.refNo} · ` : ""}opened {when(selected.createdAt)}
                  </p>
                  {toolLink(selected.contextItem) ? (
                    <a href={toolLink(selected.contextItem)!.href} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                      <i className="ti ti-external-link" aria-hidden="true" /> Open your {toolLink(selected.contextItem)!.label}
                    </a>
                  ) : null}
                </div>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[selected.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>
              </div>

              <Tracker row={selected} hasStaffReply={hasStaffReply} />

              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                  {initials(selected.ownerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-900">{selected.ownerName ?? "iCapOS team"}</p>
                  <p className="text-[11.5px] text-slate-500">
                    {selected.status === "open" && selected.dueAt && !hasStaffReply
                      ? `Reply expected by ${when(selected.dueAt)}`
                      : "Your support contact"}
                  </p>
                </div>
                {selected.ownerId ? (
                  <a
                    href={`/schedule/${selected.ownerId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <i className="ti ti-calendar" aria-hidden="true" /> Book a call
                  </a>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 p-4">
              {messages.length === 0 ? (
                <p className="text-xs text-slate-400">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${m.author_role === "founder" ? "ml-auto bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                    <p className="whitespace-pre-wrap text-[13px] leading-snug">{m.body}</p>
                    <SupportAttachments messageId={m.id} files={m.attachments} onDark={m.author_role === "founder"} />
                    <p className={`mt-1 text-[10px] ${m.author_role === "founder" ? "text-indigo-200" : "text-slate-400"}`}>
                      {m.author_role === "founder" ? "You" : selected.ownerName ?? "iCapOS team"} · {when(m.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>

            {selected.status === "resolved" ? (
              <div className="space-y-3 border-t border-slate-100 p-4">
                {selected.resolutionSummary ? (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Summary</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-700">{selected.resolutionSummary}</p>
                  </div>
                ) : null}

                {awaitingAnswer ? (
                  <div>
                    <p className="text-sm font-medium text-slate-900">Did this solve your issue?</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" disabled={busy} onClick={() => patch({ solved: true })} className="rounded-lg border border-emerald-300 px-3 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">
                        <i className="ti ti-thumb-up mr-1" aria-hidden="true" /> Yes, solved
                      </button>
                      <button type="button" disabled={busy} onClick={() => patch({ solved: false })} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                        <i className="ti ti-thumb-down mr-1" aria-hidden="true" /> No, still need help
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11.5px] text-slate-400">If it isn&apos;t solved, your request reopens with {selected.ownerName ?? "our team"} at top priority.</p>
                  </div>
                ) : askRating ? (
                  <div>
                    <p className="text-sm font-medium text-slate-900">Glad it&apos;s sorted. How was your experience with {selected.ownerName ?? "our team"}?</p>
                    <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Rating">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={rating === n}
                          aria-label={`${n} of 5`}
                          onClick={() => { setRating(n); setError(null); }}
                          className={`h-10 w-10 rounded-lg border text-lg ${n <= rating ? "border-amber-500 text-amber-500" : "border-slate-200 text-slate-300"}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      placeholder="Anything we could do better? (optional)"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                    />
                    <div className="mt-2 flex justify-end">
                      <button type="button" disabled={busy} onClick={sendRating} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                        {busy ? "Sending…" : "Send feedback"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {selected.csat === -1
                      ? "You told us this isn't solved yet."
                      : rated || selected.rating
                        ? "Thanks for your feedback."
                        : selected.closedAt
                          ? "This request is closed."
                          : "Thanks for letting us know."}{" "}
                    Need more help?{" "}
                    <button type="button" disabled={busy} onClick={() => patch({ solved: false })} className="font-medium text-indigo-600 hover:underline">
                      Reopen it
                    </button>
                  </p>
                )}
                {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
              </div>
            ) : (
              <div className="border-t border-slate-100 p-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder={selected.status === "pending_founder" ? `Reply to ${selected.ownerName ?? "the team"}…` : "Add a reply or detail…"}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
                {files.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {files.map((f) => (
                      <span key={f.path} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        <i className="ti ti-file-type-pdf text-red-500" aria-hidden="true" /> {f.name}
                        <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.path !== f.path))} className="text-slate-400 hover:text-slate-700">
                          <i className="ti ti-x" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : null}
                <div className="mt-2 flex items-center justify-end gap-2">
                  <label className={`mr-auto inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 ${uploading || files.length >= 5 ? "pointer-events-none opacity-60" : ""}`}>
                    <i className="ti ti-paperclip" aria-hidden="true" /> {uploading ? "Attaching…" : "Attach PDF"}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void attach(f);
                      }}
                    />
                  </label>
                  <button type="button" disabled={busy || !reply.trim()} onClick={sendReply} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
                {emailReplies ? <p className="mt-1.5 text-[11px] text-slate-400">You can also reply to any email we send about this request.</p> : null}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] leading-snug text-slate-400 lg:col-span-2">
        iCapOS support helps you use the platform. It is not investment, legal or tax advice. iCFO introductions and guidance are informational only and are not a recommendation or a guarantee of funding.
      </p>
    </div>
  );
}
