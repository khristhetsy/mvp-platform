"use client";

/**
 * Send email window for Outreach → Manual. Opens from the selection bar with the
 * selected investors as recipients: AI tone and draft, subject and body with
 * merge fields, attachments (one pager PDF, one pager link, data room PDFs),
 * follow ups, a live preview per recipient, a test send, and send.
 *
 * Every investor gets their own email; nobody sees the other recipients.
 */

import { useState } from "react";
import {
  MAX_ATTACHMENT_BYTES,
  withOnePagerLink,
  type ManualAttachments,
} from "@/lib/outreach/manual-attachments";
import type { AttachmentOptions, OutreachContact } from "./types";

const MERGE_FIELDS = ["{{first_name}}", "{{company}}", "{{sector}}", "{{founder_preview}}"];
const TONE_PRESETS = ["Warm", "Direct", "Concise", "Formal", "Storytelling"] as const;
const DISCLAIMER =
  "This message shares a company's Founder Preview based on stated fit. It is not investment advice, an offer, a solicitation, or a recommendation to buy or sell any security. iCapOS is not a broker-dealer or investment adviser.";

export type SeqStep = { label: string; dayOffset: number };

function kb(bytes: number | null | undefined): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The next manual outreach send pass (07:00 and 19:00 UTC, set in vercel.json), shown in PT. */
function nextSendWindow(now: Date = new Date()): string {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  const h = now.getUTCHours();
  if (h < 7) next.setUTCHours(7);
  else if (h < 19) next.setUTCHours(19);
  else {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(7);
  }
  return next.toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

function firstNameOf(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-[20px] w-[36px] shrink-0 rounded-full transition-colors ${on ? "bg-[#1A6CE4]" : "bg-slate-300"}`}
    >
      <span className={`absolute left-0 top-[2px] h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
    </button>
  );
}

export function OutreachComposer({
  recipients,
  companyName,
  sector,
  subject,
  onSubject,
  body,
  onBody,
  tone,
  onTone,
  customTone,
  onCustomTone,
  drafting,
  onDraft,
  attachments,
  onAttachments,
  options,
  sequence,
  autoFollowUps,
  onAutoFollowUps,
  stopOnReply,
  onStopOnReply,
  running,
  droppedActive,
  testing,
  onSendTest,
  saving,
  onSave,
  onSend,
  message,
  onClose,
}: {
  recipients: OutreachContact[];
  companyName: string | null;
  sector: string | null;
  subject: string;
  onSubject: (v: string) => void;
  body: string;
  onBody: (v: string) => void;
  tone: string;
  onTone: (v: string) => void;
  customTone: string;
  onCustomTone: (v: string) => void;
  drafting: boolean;
  onDraft: () => void;
  attachments: ManualAttachments;
  onAttachments: (v: ManualAttachments) => void;
  options: AttachmentOptions | null;
  sequence: SeqStep[];
  autoFollowUps: boolean;
  onAutoFollowUps: (v: boolean) => void;
  stopOnReply: boolean;
  onStopOnReply: (v: boolean) => void;
  running: boolean;
  /** Investors already in a running sequence who aren't selected now. */
  droppedActive: number;
  testing: boolean;
  onSendTest: () => void;
  saving: boolean;
  onSave: () => void;
  onSend: () => void;
  message: { tone: "ok" | "error"; text: string } | null;
  onClose: () => void;
}) {
  const sendable = recipients.filter((r) => r.email);
  const noEmail = recipients.length - sendable.length;
  const [previewId, setPreviewId] = useState<string | null>(sendable[0]?.id ?? null);
  const [docsOpen, setDocsOpen] = useState(attachments.documentIds.length > 0);
  const [showAllTo, setShowAllTo] = useState(false);

  const preview = sendable.find((r) => r.id === previewId) ?? sendable[0] ?? null;
  const onePager = options?.onePager ?? null;
  const docs = options?.documents ?? [];
  const chosenDocs = docs.filter((d) => attachments.documentIds.includes(d.id));
  const docBytes = chosenDocs.reduce((s, d) => s + (d.sizeBytes ?? 0), 0);
  const overLimit = docBytes > MAX_ATTACHMENT_BYTES - 1024 * 1024;
  const linkUnavailable = attachments.onePagerLink && !onePager?.published;
  const previewLink = onePager?.url ?? "(your one pager link, once published)";

  function merge(text: string): string {
    return text
      .replaceAll("{{first_name}}", firstNameOf(preview?.name))
      .replaceAll("{{company}}", companyName ?? "your company")
      .replaceAll("{{sector}}", sector ?? "its sector")
      .replaceAll("{{founder_preview}}", onePager?.published ? previewLink : "");
  }

  function toggleDoc(id: string) {
    const has = attachments.documentIds.includes(id);
    onAttachments({
      ...attachments,
      documentIds: has ? attachments.documentIds.filter((x) => x !== id) : [...attachments.documentIds, id],
    });
  }

  const steps = autoFollowUps ? sequence : sequence.slice(0, 1);
  const shownTo = showAllTo ? sendable : sendable.slice(0, 8);

  const card = (on: boolean) =>
    `flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
      on ? "border-2 border-[#1A6CE4] bg-blue-50/50" : "border border-slate-200 hover:border-slate-300"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Send email to investors">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Send email to {sendable.length} investor{sendable.length === 1 ? "" : "s"}
          </h2>
          {running ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Sequence running</span> : null}
          <button type="button" onClick={onClose} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ---------- Form ---------- */}
          <div className="min-w-0 space-y-4 p-5">
            {/* To */}
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">To</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {shownTo.map((r) => (
                  <span key={r.id} className="rounded-md bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-[#185FA5]">{r.name}</span>
                ))}
                {sendable.length > 8 ? (
                  <button type="button" onClick={() => setShowAllTo((v) => !v)} className="text-[12px] font-medium text-[#1A6CE4] hover:underline">
                    {showAllTo ? "Show fewer" : `+${sendable.length - 8} more`}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-[11.5px] text-slate-500">
                Sent one by one, so each investor sees only their own email.
                {noEmail > 0 ? <span className="text-amber-700"> {noEmail} selected without an email {noEmail === 1 ? "is" : "are"} skipped.</span> : null}
              </p>
            </div>

            {/* AI */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="mr-0.5 text-xs text-slate-500">AI tone</span>
              {TONE_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTone(t)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone === t ? "border-[#1A6CE4] bg-[#1A6CE4] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"}`}
                >
                  {t}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onTone("Custom")}
                className={`rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium ${tone === "Custom" ? "border-[#1A6CE4] text-[#1A6CE4]" : "border-slate-300 text-slate-500"}`}
              >
                Custom
              </button>
              {tone === "Custom" ? (
                <input value={customTone} onChange={(e) => onCustomTone(e.target.value)} placeholder="punchy, founder to founder" className="w-44 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs" />
              ) : null}
              <button type="button" onClick={onDraft} disabled={drafting} className="ml-auto rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                <i className="ti ti-sparkles" aria-hidden="true" /> {drafting ? "Drafting…" : "Draft with AI"}
              </button>
            </div>

            {/* Subject / body */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="mo-subject">Subject</label>
              <input id="mo-subject" value={subject} onChange={(e) => onSubject(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="mo-body">Body</label>
              <textarea id="mo-body" value={body} rows={8} onChange={(e) => onBody(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-relaxed" />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map((f) => (
                  <button key={f} type="button" onClick={() => onBody(`${body}${f}`)} className="rounded bg-blue-50 px-2 py-0.5 text-[11px] text-[#185FA5] hover:bg-blue-100">
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Attachments */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">Attachments</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" className={card(attachments.onePagerPdf)} onClick={() => onAttachments({ ...attachments, onePagerPdf: !attachments.onePagerPdf })} aria-pressed={attachments.onePagerPdf}>
                  <i className="ti ti-file-type-pdf mt-0.5 text-lg text-[#1A6CE4]" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-slate-900">One pager PDF</span>
                    <span className="block text-[11px] text-slate-500">Made from your profile</span>
                  </span>
                </button>
                <button type="button" className={card(attachments.onePagerLink)} onClick={() => onAttachments({ ...attachments, onePagerLink: !attachments.onePagerLink })} aria-pressed={attachments.onePagerLink}>
                  <i className="ti ti-link mt-0.5 text-lg text-[#1A6CE4]" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-slate-900">One pager link</span>
                    <span className="block text-[11px] text-slate-500">{onePager?.published ? "Live page, tracks clicks" : "Needs a published profile"}</span>
                  </span>
                </button>
                <button type="button" className={card(attachments.documentIds.length > 0 || docsOpen)} onClick={() => setDocsOpen((v) => !v)} aria-expanded={docsOpen}>
                  <i className="ti ti-folder mt-0.5 text-lg text-[#1A6CE4]" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-slate-900">From data room</span>
                    <span className="block text-[11px] text-slate-500">
                      {attachments.documentIds.length > 0 ? `${attachments.documentIds.length} chosen` : "Pitch deck, financials"}
                    </span>
                  </span>
                </button>
              </div>

              {docsOpen ? (
                <div className="mt-2 rounded-lg border border-slate-200">
                  {docs.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-slate-500">
                      No PDFs in your data room yet. Upload them under Stage 2, Data room.
                    </p>
                  ) : (
                    <ul className="max-h-40 overflow-y-auto">
                      {docs.map((d) => (
                        <li key={d.id} className="border-b border-slate-100 last:border-b-0">
                          <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[12.5px] hover:bg-slate-50">
                            <input type="checkbox" checked={attachments.documentIds.includes(d.id)} onChange={() => toggleDoc(d.id)} />
                            <span className="min-w-0 flex-1 truncate text-slate-800">{d.name}</span>
                            <span className="shrink-0 text-[11px] text-slate-400">{kb(d.sizeBytes)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                {attachments.onePagerPdf && onePager ? (
                  <a href="/api/founder/outreach/one-pager-pdf" target="_blank" rel="noopener noreferrer" className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 hover:bg-slate-200">
                    <i className="ti ti-paperclip" aria-hidden="true" /> {onePager.fileName} · preview
                  </a>
                ) : null}
                {chosenDocs.map((d) => (
                  <span key={d.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                    <i className="ti ti-paperclip" aria-hidden="true" /> {d.name} {kb(d.sizeBytes) ? `· ${kb(d.sizeBytes)}` : ""}
                  </span>
                ))}
                {attachments.onePagerLink && onePager?.published ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700"><i className="ti ti-link" aria-hidden="true" /> One pager link</span>
                ) : null}
              </div>
              {linkUnavailable ? (
                <p className="mt-1 text-[11.5px] text-amber-700">Your profile isn&apos;t published, so no link is added. Publish it from Public Profile to share the live page.</p>
              ) : null}
              {overLimit ? (
                <p className="mt-1 text-[11.5px] text-amber-700">Attachments are over 9 MB. Files past the 10 MB limit are left off; consider sending the link instead.</p>
              ) : null}
            </div>

            {/* Follow ups */}
            <div className="rounded-lg border border-slate-200 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-900">Automatic follow ups</p>
                  <p className="text-[11.5px] text-slate-500">{steps.map((s) => `Day ${s.dayOffset}`).join(", ")}</p>
                </div>
                <Toggle on={autoFollowUps} onClick={() => onAutoFollowUps(!autoFollowUps)} label="Automatic follow ups" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                <p className="text-[13px] text-slate-700">Stop when the investor replies</p>
                <Toggle on={stopOnReply} onClick={() => onStopOnReply(!stopOnReply)} label="Stop on reply" />
              </div>
            </div>

            <p className="text-[11.5px] leading-relaxed text-slate-500">
              <i className="ti ti-info-circle" aria-hidden="true" /> Each email carries the compliance disclaimer and an unsubscribe link, and skips anyone on
              the suppression list. Emails go out at the next send window, {nextSendWindow()}. Investors already in this sequence keep their
              place; only new ones get the first email.
            </p>
            {droppedActive > 0 ? (
              <p className="text-[11.5px] text-amber-700">
                {droppedActive} investor{droppedActive === 1 ? " is" : "s are"} in the running sequence but not selected. Sending stops their
                remaining follow ups. Select them too to keep them in.
              </p>
            ) : null}
          </div>

          {/* ---------- Preview ---------- */}
          <div className="min-w-0 border-t border-slate-100 bg-slate-50 p-4 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Preview as</span>
              <select
                value={preview?.id ?? ""}
                onChange={(e) => setPreviewId(e.target.value)}
                className="min-w-0 max-w-[190px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                aria-label="Preview as"
              >
                {sendable.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">To</p>
              <p className="mb-2 truncate text-[12.5px] text-slate-700">{preview ? `${preview.name} · ${preview.email}` : "No recipient with an email"}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Subject</p>
              <p className="mb-2 text-[13px] font-medium text-slate-900">{merge(subject) || `An introduction to ${companyName ?? "your company"}`}</p>
              <div className="whitespace-pre-wrap border-t border-slate-100 pt-2 text-[12.5px] leading-6 text-slate-700">
                {merge(withOnePagerLink(body, attachments))}
              </div>
              {(attachments.onePagerPdf && onePager) || chosenDocs.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                  {attachments.onePagerPdf && onePager ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-600"><i className="ti ti-paperclip" aria-hidden="true" /> {onePager.fileName}</span>
                  ) : null}
                  {chosenDocs.map((d) => (
                    <span key={d.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-600"><i className="ti ti-paperclip" aria-hidden="true" /> {d.fileName ?? d.name}</span>
                  ))}
                </div>
              ) : null}
              <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-snug text-slate-400">{DISCLAIMER} To stop receiving these emails, unsubscribe.</p>
            </div>
            <p className="mt-2 text-[10.5px] text-slate-400">Follow ups reuse this subject and body on their day.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          {message ? (
            <p className={`mr-auto text-xs ${message.tone === "ok" ? "text-emerald-700" : "text-red-600"}`} role="status">{message.text}</p>
          ) : (
            <span className="mr-auto" />
          )}
          <button type="button" onClick={onSendTest} disabled={testing || !body.trim()} className="rounded-md border border-slate-200 px-3.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {testing ? "Sending…" : "Send test to me"}
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-slate-200 px-3.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Save draft
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={saving || sendable.length === 0}
            className="cap-btn-primary rounded-md px-4 py-1.5 text-[13px] font-semibold disabled:opacity-50"
          >
            {saving ? "Sending…" : `Send to ${sendable.length} investor${sendable.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
