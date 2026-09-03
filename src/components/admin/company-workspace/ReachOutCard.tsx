"use client";

import { useCallback, useEffect, useState } from "react";

// Combined "Reach out to founder" + "Draft email" card. On mount it auto-drafts an
// email that summarizes the stage's pending gates (via the reach-out API), which the
// staff member can edit and then save to, or send from, their own Gmail. Investor
// access is a paid entitlement, so for a founder who can't distribute yet, an
// optional upgrade line can be appended — kept separate from the readiness checklist.

const UPGRADE_LINE =
  "\n\nWhen you're ready to reach investors, investor access is available on a paid plan — reply and we'll walk you through the options.";

export function ReachOutCard({
  companyId,
  founderName,
  founderEmail,
  stageLabel,
  pendingItems,
  founderCanDistribute,
}: Readonly<{
  companyId: string;
  founderName: string;
  founderEmail: string | null;
  stageLabel: string;
  pendingItems: string[];
  founderCanDistribute: boolean;
}>) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [appendSignature, setAppendSignature] = useState(true);
  const [alsoNudge, setAlsoNudge] = useState(false);
  const [includeUpgrade, setIncludeUpgrade] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "save" | "send">(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const loadDraft = useCallback(async () => {
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
        setIncludeUpgrade(false);
      } else {
        setNotice({ kind: "err", text: j.error ?? "Could not draft the email." });
      }
    } finally {
      setBusy(null);
    }
  }, [companyId, pendingItems, stageLabel]);

  // Auto-draft the gate summary once on mount so the card opens ready to edit/send.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch sets state after mount
    void loadDraft();
  }, [loadDraft]);

  function toggleUpgrade(next: boolean) {
    setIncludeUpgrade(next);
    setBody((b) => {
      const stripped = b.replace(UPGRADE_LINE, "");
      return next ? stripped + UPGRADE_LINE : stripped;
    });
  }

  async function act(action: "save-draft" | "send") {
    if (action === "send" && !window.confirm(`Send this email to ${founderEmail ?? "the founder"} from your Gmail now?`)) return;
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

  const connectHref = `/api/integrations/google/connect?returnTo=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.pathname + window.location.hash : "/admin",
  )}`;

  return (
    <div id="reach-out-founder" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Header — carries the reach-out identity + pending count */}
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <i className="ti ti-mail text-[19px]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-slate-900">Reach out to founder</p>
            <p className="text-xs text-slate-500">{founderName} · {stageLabel} · <i className="ti ti-brand-google" aria-hidden="true" /> via your Gmail</p>
          </div>
        </div>
        <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">{pendingItems.length} pending</span>
      </div>

      {/* Draft email */}
      <div className="border-t border-slate-100 px-4 py-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Draft email</span>
          <span className="text-[11px] text-slate-400">
            <i className="ti ti-sparkles" aria-hidden="true" /> AI-summarized from the pending gates{busy === "draft" ? " · drafting…" : ""}
          </span>
        </div>

        <label className="mb-1 block text-[11px] font-medium text-slate-600">To</label>
        <input value={founderEmail ?? ""} readOnly className="mb-2.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" />

        <label className="mb-1 block text-[11px] font-medium text-slate-600">Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mb-2.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />

        <label className="mb-1 block text-[11px] font-medium text-slate-600">Message</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none" />

        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={appendSignature} onChange={(e) => setAppendSignature(e.target.checked)} /> Append my signature
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={alsoNudge} onChange={(e) => setAlsoNudge(e.target.checked)} /> Also drop an in-app nudge
          </label>
        </div>

        {/* Plan-aware access note — only when the founder can't distribute yet */}
        {!founderCanDistribute ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
            <i className="ti ti-lock mt-0.5 text-sky-700" aria-hidden="true" />
            <div className="text-[11.5px] leading-relaxed text-sky-900">
              <span className="font-semibold">Investor access is a separate step on a paid plan.</span> Becoming investor-ready doesn&apos;t grant it.
              <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-sky-800">
                <input type="checkbox" checked={includeUpgrade} onChange={(e) => toggleUpgrade(e.target.checked)} /> Include an upgrade-to-access mention in the email
              </label>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div className="mt-3 text-xs font-medium">
            <p className={notice.kind === "ok" ? "text-emerald-600" : "text-red-600"}>{notice.text}</p>
            {notice.kind === "err" && /connect/i.test(notice.text) ? (
              <a href={connectHref} className="mt-1 inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 hover:bg-indigo-100">
                <i className="ti ti-brand-google" aria-hidden="true" /> Connect Google (with Gmail)
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
        <button type="button" onClick={() => void loadDraft()} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60">
          <i className="ti ti-refresh" aria-hidden="true" /> Regenerate
        </button>
        <span className="ml-auto" />
        <button type="button" onClick={() => void act("save-draft")} disabled={busy !== null || !subject || !body} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {busy === "save" ? "Saving…" : "Save to Gmail drafts"}
        </button>
        <button type="button" onClick={() => void act("send")} disabled={busy !== null || !subject || !body} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy === "send" ? "Sending…" : "Send from my Gmail"}
        </button>
      </div>
    </div>
  );
}
