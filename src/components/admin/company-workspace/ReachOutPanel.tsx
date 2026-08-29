"use client";

import { useState } from "react";

/**
 * "Reach out to founder" — drafts an email from the stage's pending items and
 * sends it through the staff member's own Gmail (draft or send), with their saved
 * signature. Sending asks for confirmation first.
 */
export function ReachOutPanel({
  companyId,
  founderName,
  founderEmail,
  stageLabel,
  pendingItems,
}: Readonly<{
  companyId: string;
  founderName: string;
  founderEmail: string | null;
  stageLabel: string;
  pendingItems: string[];
}>) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [appendSignature, setAppendSignature] = useState(true);
  const [alsoNudge, setAlsoNudge] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "save" | "send">(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function loadDraft() {
    setBusy("draft");
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/reach-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft", items: pendingItems, stage: stageLabel }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubject(j.subject ?? "");
        setBody(j.body ?? "");
      } else {
        setNotice({ kind: "err", text: j.error ?? "Could not draft the email." });
      }
    } finally {
      setBusy(null);
    }
  }

  async function act(action: "save-draft" | "send") {
    if (action === "send" && !window.confirm(`Send this email to ${founderEmail} from your Gmail now?`)) return;
    setBusy(action === "send" ? "send" : "save");
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/reach-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subject, body, appendSignature, alsoNudge }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice({ kind: "ok", text: action === "send" ? "Sent from your Gmail." : "Saved to your Gmail Drafts." });
      } else {
        setNotice({ kind: "err", text: j.error ?? "Something went wrong." });
      }
    } finally {
      setBusy(null);
    }
  }

  async function openPanel() {
    setOpen(true);
    setNotice(null);
    if (!body) await loadDraft();
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <i className="ti ti-mail" aria-hidden="true" /> Reach out to founder
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Reach out to {founderName}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {stageLabel} · {pendingItems.length} pending · <i className="ti ti-brand-google" aria-hidden="true" /> via your Gmail
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">✕</button>
            </div>

            <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
            <input value={founderEmail ?? ""} readOnly className="mb-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" />

            <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />

            <label className="mb-1 block text-xs font-medium text-slate-600">Message {busy === "draft" ? <span className="text-slate-400">· drafting…</span> : null}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none" />

            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={appendSignature} onChange={(e) => setAppendSignature(e.target.checked)} /> Append my signature
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={alsoNudge} onChange={(e) => setAlsoNudge(e.target.checked)} /> Also drop an in-app nudge
              </label>
            </div>

            {notice ? (
              <div className="mt-3 text-xs font-medium">
                <p className={notice.kind === "ok" ? "text-emerald-600" : "text-red-600"}>{notice.text}</p>
                {notice.kind === "err" && /connect/i.test(notice.text) ? (
                  <a
                    href={`/api/integrations/google/connect?returnTo=${encodeURIComponent(
                      typeof window !== "undefined" ? window.location.pathname + window.location.hash : "/admin",
                    )}`}
                    className="mt-1 inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 hover:bg-indigo-100"
                  >
                    <i className="ti ti-brand-google" aria-hidden="true" /> Connect Google (with Gmail)
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={loadDraft} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60">
                <i className="ti ti-sparkles" aria-hidden="true" /> Redraft
              </button>
              <span className="ml-auto" />
              <button type="button" onClick={() => act("save-draft")} disabled={busy !== null || !subject || !body} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {busy === "save" ? "Saving…" : "Save to Gmail drafts"}
              </button>
              <button type="button" onClick={() => act("send")} disabled={busy !== null || !subject || !body} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {busy === "send" ? "Sending…" : "Send from my Gmail"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
