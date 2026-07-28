"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Marketing-Hub-style manual investor outreach builder for Outreach → Manual.
 * Four tabs (Audience → Compose → Sequence → Review) with a Continue
 * progression; Review is gated until an audience is selected.
 *
 * Persistence goes through /api/founder/outreach/manual. "Start sequence" marks
 * the campaign queued — live email dispatch reuses the platform send path and is
 * gated the same way as automated outreach (INVESTOR_OUTREACH_LIVE); this builder
 * does not itself email anyone.
 */

export type OutreachAudienceContact = {
  id: string;
  name: string;
  email: string | null;
  detail?: string | null;
};

type Tab = 0 | 1 | 2 | 3;
type SeqStep = { label: string; dayOffset: number };
type RecipientStatus = {
  name: string | null;
  email: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
};

function recipientStage(r: RecipientStatus): { label: string; cls: string; at: string | null } {
  if (r.repliedAt) return { label: "Replied", cls: "bg-teal-50 text-teal-700", at: r.repliedAt };
  if (r.clickedAt) return { label: "Clicked", cls: "bg-teal-50 text-teal-700", at: r.clickedAt };
  if (r.openedAt) return { label: "Opened", cls: "bg-emerald-50 text-emerald-700", at: r.openedAt };
  if (r.status === "skipped") return { label: "Skipped", cls: "bg-slate-100 text-slate-500", at: null };
  if (r.status === "stopped") return { label: "Stopped", cls: "bg-slate-100 text-slate-500", at: r.sentAt };
  if (r.sentAt) return { label: "Sent", cls: "bg-indigo-50 text-indigo-700", at: r.sentAt };
  return { label: "Queued", cls: "bg-amber-50 text-amber-700", at: null };
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const TABS = ["Audience", "Compose", "Sequence", "Review & send"];
const CONTINUE_LABELS = ["Continue → Compose", "Continue → Sequence", "Continue → Review", ""];

const DEFAULT_SUBJECT = "{{first_name}}, a quick intro to {{company}}";
const DEFAULT_BODY =
  "Hi {{first_name}},\n\nBased on your focus, {{company}} may be a fit. Here's our one-pager: {{founder_preview}}\n\nOpen to a quick intro?";
const DEFAULT_SEQUENCE: SeqStep[] = [
  { label: "Initial email — Warm intro", dayOffset: 0 },
  { label: "Follow-up — “Did you get a chance?”", dayOffset: 3 },
  { label: "Final — “Closing the loop”", dayOffset: 7 },
];
const MERGE_FIELDS = ["{{first_name}}", "{{company}}", "{{founder_preview}}", "{{sector}}"];

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-[21px] w-[38px] shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-300 ${on ? "bg-indigo-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-[17px] w-[17px] rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-[19px]" : "translate-x-0.5"}`} />
    </button>
  );
}

export function ManualOutreachBuilder({
  contacts,
  initial,
}: {
  contacts: OutreachAudienceContact[];
  initial?: {
    status?: "draft" | "queued";
    emailSubject?: string;
    emailBody?: string;
    sequence?: SeqStep[];
    recipientIds?: string[];
    stopOnReply?: boolean;
  } | null;
}) {
  const [tab, setTab] = useState<Tab>(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.recipientIds ?? []));
  const [subject, setSubject] = useState(initial?.emailSubject || DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(initial?.emailBody || DEFAULT_BODY);
  const [autoFollowUps, setAutoFollowUps] = useState(true);
  const [stopOnReply, setStopOnReply] = useState(initial?.stopOnReply ?? true);
  const [sequence] = useState<SeqStep[]>(initial?.sequence?.length ? initial.sequence : DEFAULT_SEQUENCE);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"draft" | "queued">(initial?.status ?? "draft");
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [recipients, setRecipients] = useState<RecipientStatus[]>([]);

  // Load any previously-saved campaign + recipient statuses (unless a snapshot
  // was passed in).
  useEffect(() => {
    if (initial) return;
    let active = true;
    void fetch("/api/founder/outreach/manual")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          campaign?: { status?: string; emailSubject?: string; emailBody?: string; sequence?: SeqStep[]; recipientIds?: string[]; stopOnReply?: boolean } | null;
          recipients?: RecipientStatus[];
        } | null) => {
          if (!active) return;
          const c = data?.campaign;
          if (c) {
            if (c.emailSubject) setSubject(c.emailSubject);
            if (c.emailBody) setEmailBody(c.emailBody);
            if (Array.isArray(c.recipientIds)) setSelected(new Set(c.recipientIds));
            if (typeof c.stopOnReply === "boolean") setStopOnReply(c.stopOnReply);
            if (c.status === "queued") setStatus("queued");
          }
          if (Array.isArray(data?.recipients)) setRecipients(data.recipients);
        },
      )
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCount = selected.size;
  const activeSteps = useMemo(() => (autoFollowUps ? sequence : sequence.slice(0, 1)), [autoFollowUps, sequence]);

  function markDirty() {
    setDirty(true);
    setMessage(null);
  }
  function toggleContact(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    markDirty();
  }
  function goto(next: Tab) {
    if (next === 3 && selectedCount === 0) return;
    setTab(next);
  }

  async function persist(action: "save" | "start") {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/founder/outreach/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          subject,
          body: emailBody,
          sequence: activeSteps,
          recipientIds: [...selected],
          stopOnReply,
        }),
      });
      const data = (await res.json().catch(() => null)) as { status?: string; error?: string } | null;
      if (!res.ok) {
        setMessage(data?.error ?? "Something went wrong.");
        return;
      }
      setDirty(false);
      if (action === "start") {
        setStatus("queued");
        setMessage("Sequence started — investors will be contacted per the send schedule.");
      } else {
        setMessage("Saved.");
      }
    } catch {
      setMessage("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Investor outreach</h2>
          <p className="mt-1 text-sm text-slate-600">
            Build a list, draft the emails, and let iCapOS run the follow-up sequence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status === "queued" ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Running</span>
          ) : dirty ? (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          ) : null}
          <button
            type="button"
            onClick={() => void persist("save")}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save campaign"}
          </button>
        </div>
      </div>

      {/* AI kit */}
      <div className="mt-4 rounded-lg border border-indigo-300 bg-indigo-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-900">✦ AI outreach kit</span>
          <input
            placeholder="Tone — warm, concise…"
            className="ml-auto w-48 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
          />
          <button type="button" className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
            Draft emails
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Claude drafts your subject, body, and the full follow-up sequence from your company profile. Everything stays
          editable.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {TABS.map((label, i) => {
          const locked = i === 3 && selectedCount === 0;
          return (
            <button
              key={label}
              type="button"
              onClick={() => goto(i as Tab)}
              disabled={locked}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                tab === i
                  ? "border-indigo-600 text-indigo-600"
                  : locked
                    ? "cursor-not-allowed border-transparent text-slate-300"
                    : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-[200px]">
        {/* Audience */}
        {tab === 0 ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Your investors <span className="text-slate-400">— tap to add or remove from this campaign</span>
            </label>
            {contacts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No investors in your list yet. Add contacts or import a CSV in the CRM above, then build your campaign here.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {contacts.map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggleContact(c.id)}
                        className="flex w-full items-center gap-3 py-2 text-left"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${on ? "bg-indigo-600 text-[11px] text-white" : "border-[1.5px] border-slate-300"}`}
                        >
                          {on ? "✓" : ""}
                        </span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-medium text-indigo-700">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {c.detail ?? c.email ?? "No email on file"}
                          </span>
                        </span>
                        {!c.email ? <span className="text-[10px] text-amber-600">No email</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              <b className="text-slate-800">{selectedCount} selected</b> · they will enter the sequence.
            </p>
          </div>
        ) : null}

        {/* Compose */}
        {tab === 1 ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
              <input
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Body</label>
              <textarea
                value={emailBody}
                rows={6}
                onChange={(e) => {
                  setEmailBody(e.target.value);
                  markDirty();
                }}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setEmailBody((b) => `${b}${f}`);
                      markDirty();
                    }}
                    className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Sequence */}
        {tab === 2 ? (
          <div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-900">Automatic follow-ups</p>
                <p className="text-xs text-slate-500">Send the steps below on schedule until they reply.</p>
              </div>
              <Switch on={autoFollowUps} onClick={() => { setAutoFollowUps((v) => !v); markDirty(); }} label="Automatic follow-ups" />
            </div>
            <ul className="divide-y divide-slate-100">
              {activeSteps.map((s, i) => (
                <li key={s.label} className="flex items-center gap-3 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{s.label}</span>
                  <span className="shrink-0 text-xs text-slate-500">Day {s.dayOffset}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Stop when the investor replies</p>
                <p className="text-xs text-slate-500">No more auto-sends once they respond.</p>
              </div>
              <Switch on={stopOnReply} onClick={() => { setStopOnReply((v) => !v); markDirty(); }} label="Stop on reply" />
            </div>
          </div>
        ) : null}

        {/* Review */}
        {tab === 3 ? (
          <div>
            <dl className="text-sm">
              <div className="flex justify-between border-b border-slate-100 py-2">
                <dt className="text-slate-500">Recipients</dt>
                <dd className="font-medium text-slate-800">{selectedCount} investors</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-2">
                <dt className="text-slate-500">Sequence</dt>
                <dd className="font-medium text-slate-800">
                  {activeSteps.length} step{activeSteps.length === 1 ? "" : "s"}
                  {stopOnReply ? " · stops on reply" : ""}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Schedule</dt>
                <dd className="font-medium text-slate-800">
                  {activeSteps.map((s) => `Day ${s.dayOffset}`).join(" · ")}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
              <span aria-hidden="true">ⓘ</span>
              <span>
                Each email includes an unsubscribe link and honors the platform suppression list. This shares your Founder
                Preview and is not an offer or solicitation of securities.
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void persist("start")}
                disabled={saving || selectedCount === 0}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Starting…" : status === "queued" ? "Update sequence" : "Start sequence"}
              </button>
              <button type="button" className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Send test to me
              </button>
            </div>

            {recipients.length > 0 ? (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-900">Recipient activity</h3>
                  <span className="text-xs text-slate-400">{recipients.length} enrolled</span>
                </div>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {recipients.map((r) => {
                    const stage = recipientStage(r);
                    return (
                      <li key={r.email} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-medium text-indigo-700">
                          {(r.name ?? r.email).slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-800">{r.name ?? r.email}</span>
                          {r.name ? <span className="block truncate text-xs text-slate-400">{r.email}</span> : null}
                        </span>
                        {stage.at ? <span className="shrink-0 text-xs text-slate-400">{shortDate(stage.at)}</span> : null}
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${stage.cls}`}>
                          {stage.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Footer: Continue / Back progression + messages */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => setTab((t) => (t > 0 ? ((t - 1) as Tab) : t))}
          className={`rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 ${tab === 0 ? "invisible" : ""}`}
        >
          ← Back
        </button>
        <div className="ml-auto flex items-center gap-3">
          {message ? <span className="text-xs text-slate-500">{message}</span> : null}
          {tab === 0 && selectedCount === 0 ? (
            <span className="text-xs text-slate-400">Add at least one investor to continue</span>
          ) : null}
          {tab < 3 ? (
            <button
              type="button"
              onClick={() => goto((tab + 1) as Tab)}
              disabled={tab === 0 && selectedCount === 0}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {CONTINUE_LABELS[tab]}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
