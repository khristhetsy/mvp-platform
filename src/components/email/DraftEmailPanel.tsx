"use client";

import { useMemo, useState } from "react";
import { formatDraftForClipboard } from "@/lib/email/display";
import type { EmailDraft, EmailTemplateType } from "@/lib/email/types";
import type { UserRole } from "@/lib/supabase/types";

const TEMPLATES_BY_ROLE: Record<UserRole, Array<{ type: EmailTemplateType; label: string }>> = {
  founder: [
    { type: "founder_investor_intro_followup", label: "Investor intro follow-up" },
    { type: "founder_onboarding_reminder", label: "Onboarding reminder" },
    { type: "meeting_followup", label: "Meeting follow-up" },
  ],
  investor: [
    { type: "investor_spv_requirement_reminder", label: "SPV requirement reminder" },
    { type: "meeting_followup", label: "Meeting follow-up" },
  ],
  admin: [
    { type: "admin_company_review_followup", label: "Company review follow-up" },
    { type: "admin_investor_approval_followup", label: "Investor approval follow-up" },
    { type: "compliance_followup", label: "Compliance follow-up" },
    { type: "meeting_followup", label: "Meeting follow-up" },
    { type: "import_failure_notice", label: "Import failure notice" },
    { type: "investor_spv_requirement_reminder", label: "SPV requirement reminder" },
  ],
  analyst: [
    { type: "admin_company_review_followup", label: "Company review follow-up" },
    { type: "compliance_followup", label: "Compliance follow-up" },
    { type: "meeting_followup", label: "Meeting follow-up" },
    { type: "import_failure_notice", label: "Import failure notice" },
  ],
};

export function DraftEmailPanel({
  role,
  entityType,
  entityId,
  sourceActionId,
  defaultTemplate,
  compact,
}: Readonly<{
  role: UserRole;
  entityType?: string | null;
  entityId?: string | null;
  sourceActionId?: string | null;
  defaultTemplate?: EmailTemplateType;
  compact?: boolean;
}>) {
  const options = TEMPLATES_BY_ROLE[role] ?? [];
  const [open, setOpen] = useState(false);
  const [templateType, setTemplateType] = useState<EmailTemplateType>(
    defaultTemplate ?? options[0]?.type ?? "meeting_followup",
  );
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [safetyNotes, setSafetyNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canDraft = options.length > 0;

  const templateOptions = useMemo(() => {
    if (defaultTemplate) return options.filter((o) => o.type === defaultTemplate);
    return options;
  }, [defaultTemplate, options]);

  async function generateDraft() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
          sourceActionId: sourceActionId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate draft.");
      setDraft(data.draft);
      setSafetyNotes(data.safetyNotes ?? data.draft?.safetyNotes ?? []);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyDraft() {
    if (!draft) return;
    await navigator.clipboard.writeText(formatDraftForClipboard(draft));
    setCopied(true);
  }

  if (!canDraft) return null;

  return (
    <div className={compact ? "" : "rounded-xl border border-slate-200/80 bg-slate-50/50 p-3"}>
      <div className="flex flex-wrap items-center gap-2">
        {!defaultTemplate ? (
          <select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value as EmailTemplateType)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          >
            {templateOptions.map((o) => (
              <option key={o.type} value={o.type}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void generateDraft()}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 disabled:opacity-50"
        >
          {busy ? "Drafting…" : "Draft email"}
        </button>
        <span className="text-[10px] text-slate-500">Draft only — not sent</span>
      </div>

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      {open && draft ? (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <p className="font-semibold text-slate-900">Subject: {draft.subject}</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-slate-700">{draft.body}</pre>
          <ul className="list-disc pl-4 text-[10px] text-amber-900">
            {safetyNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyDraft()}
              className="rounded border border-slate-200 px-2 py-1 text-[10px] font-medium"
            >
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-slate-500 underline">
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
