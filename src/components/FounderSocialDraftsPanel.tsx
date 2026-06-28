"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SocialOutreachReadinessResult } from "@/lib/founder-crm/social-outreach-readiness";
import type { OutreachCampaignRecord, SocialOutreachDraftRecord } from "@/lib/founder-crm/types";

const DRAFT_TYPES = [
  { value: "linkedin_campaign_announcement", label: "LinkedIn campaign announcement" },
  { value: "investor_update", label: "Investor update" },
  { value: "readiness_milestone", label: "Readiness milestone" },
  { value: "traction_update", label: "Traction update" },
  { value: "fundraising_update", label: "Fundraising update" },
  { value: "thought_leadership", label: "Thought leadership" },
  { value: "follow_up_post", label: "Follow-up post" },
] as const;

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "x_twitter", label: "X (Twitter)" },
  { value: "general", label: "General" },
] as const;

function detectRiskyPhrasesClient(body: string) {
  const patterns = [
    "guaranteed return",
    "guaranteed investment",
    "risk-free",
    "guaranteed funding",
    "sec approved",
    "assured profit",
  ];
  const normalized = body.toLowerCase();
  return patterns.filter((phrase) => normalized.includes(phrase));
}

const COMPLIANCE_WARNINGS = [
  "Review before posting.",
  "Do not include confidential securities offering details.",
  "Do not promise returns.",
  "Do not imply guaranteed funding.",
  "Use only approved public information.",
];

type Props = {
  initialDrafts: SocialOutreachDraftRecord[];
  socialReadiness: SocialOutreachReadinessResult;
  campaigns: OutreachCampaignRecord[];
};

export function FounderSocialDraftsPanel({
  initialDrafts,
  socialReadiness,
  campaigns,
}: Readonly<Props>) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [draftType, setDraftType] = useState<string>("linkedin_campaign_announcement");
  const [platform, setPlatform] = useState<string>("linkedin");
  const [campaignId, setCampaignId] = useState("");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [complianceStatus, setComplianceStatus] = useState<string>("needs_review");
  const [riskyPhrases, setRiskyPhrases] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeDraft = useMemo(
    () => drafts.find((row) => row.id === activeDraftId) ?? null,
    [drafts, activeDraftId],
  );

  function selectDraft(row: SocialOutreachDraftRecord) {
    setActiveDraftId(row.id);
    setTitle(row.title);
    setBody(row.body);
    setComplianceStatus(row.compliance_status);
    setRiskyPhrases([]);
  }

  async function generateDraft(save: boolean) {
    if (!socialReadiness.allowed) {
      setMessage("Complete social outreach readiness requirements first.");
      return;
    }

    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/founder/social-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftType,
        platform,
        campaignId: campaignId || undefined,
        save,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      preview?: { title: string; body: string };
      draft?: SocialOutreachDraftRecord;
      complianceStatus?: string;
      riskyPhrases?: string[];
      error?: string;
    } | null;
    setLoading(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to generate draft.");
      return;
    }

    const preview = payload?.draft ?? payload?.preview;
    if (!preview) {
      setMessage("No draft returned.");
      return;
    }

    setTitle(preview.title);
    setBody(preview.body);
    setComplianceStatus(payload?.complianceStatus ?? payload?.draft?.compliance_status ?? "needs_review");
    setRiskyPhrases(payload?.riskyPhrases ?? []);

    if (payload?.draft) {
      setDrafts((rows) => [payload.draft!, ...rows.filter((row) => row.id !== payload.draft!.id)]);
      setActiveDraftId(payload.draft.id);
      setMessage("Draft generated and saved.");
      router.refresh();
    } else {
      setActiveDraftId(null);
      setMessage("Preview generated — save when ready.");
    }
  }

  async function saveEdits() {
    if (!activeDraftId) {
      setMessage("Generate or select a draft first.");
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/founder/social-drafts/${activeDraftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const payload = (await response.json().catch(() => null)) as {
      draft?: SocialOutreachDraftRecord;
      riskyPhrases?: string[];
      error?: string;
    } | null;
    setLoading(false);

    if (!response.ok || !payload?.draft) {
      setMessage(payload?.error ?? "Unable to save edits.");
      return;
    }

    setDrafts((rows) => rows.map((row) => (row.id === payload.draft!.id ? payload.draft! : row)));
    setComplianceStatus(payload.draft.compliance_status);
    setRiskyPhrases(payload.riskyPhrases ?? detectRiskyPhrasesClient(payload.draft.body));
    setMessage("Draft saved.");
  }

  async function runAction(action: "review" | "copy" | "archive") {
    if (!activeDraftId) {
      return;
    }

    if (action === "copy" && riskyPhrases.length > 0) {
      setMessage("Resolve flagged phrases before copying.");
      return;
    }

    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(`${title}\n\n${body}`);
      } catch {
        setMessage("Unable to access clipboard.");
        return;
      }
    }

    setLoading(true);
    const response = await fetch(`/api/founder/social-drafts/${activeDraftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json().catch(() => null)) as {
      draft?: SocialOutreachDraftRecord;
      copyBlocked?: boolean;
      riskyPhrases?: string[];
      error?: string;
    } | null;
    setLoading(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "Action failed.");
      return;
    }

    if (payload?.copyBlocked) {
      setMessage("Copy blocked — flagged compliance phrases detected.");
      return;
    }

    if (action === "archive") {
      setDrafts((rows) => rows.filter((row) => row.id !== activeDraftId));
      setActiveDraftId(null);
      setTitle("");
      setBody("");
      setMessage("Draft archived.");
      router.refresh();
      return;
    }

    if (payload?.draft) {
      setDrafts((rows) => rows.map((row) => (row.id === payload.draft!.id ? payload.draft! : row)));
      setComplianceStatus(payload.draft.compliance_status);
    }

    setMessage(action === "copy" ? "Copied to clipboard and marked as copied." : "Marked as reviewed.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Social outreach readiness</h2>
        <p className="mt-1 text-sm text-slate-600">
          Founder-controlled content only — no LinkedIn API, OAuth, auto-posting, or scraping.
        </p>
        <ul className="mt-4 space-y-2">
          {socialReadiness.requirements.map((row) => (
            <li key={row.key} className="flex items-center gap-2 text-sm">
              <span className={row.met ? "text-emerald-600" : "text-amber-600"}>{row.met ? "✓" : "○"}</span>
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-semibold text-amber-950">Compliance guardrails</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
          {COMPLIANCE_WARNINGS.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Generate social draft</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-xs font-medium text-slate-600">
              Draft type
              <select
                value={draftType}
                onChange={(event) => setDraftType(event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                {DRAFT_TYPES.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Platform
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                {PLATFORMS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            {campaigns.length > 0 ? (
              <label className="text-xs font-medium text-slate-600">
                Campaign context (optional)
                <select
                  value={campaignId}
                  onChange={(event) => setCampaignId(event.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {campaigns.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void generateDraft(false)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Preview
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void generateDraft(true)}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Generate &amp; save
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Saved drafts ({drafts.length})</h2>
          <div className="mt-4 max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {drafts.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">No social drafts yet.</p>
            ) : (
              drafts.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => selectDraft(row)}
                  className={`block w-full py-3 text-left text-sm ${activeDraftId === row.id ? "bg-indigo-50" : ""}`}
                >
                  <p className="font-medium text-slate-900">{row.title}</p>
                  <p className="text-xs text-slate-500">
                    {row.draft_type} · {row.platform} · {row.status} · {row.compliance_status}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {(title || body || activeDraft) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Draft editor</h2>
          {complianceStatus === "flagged" || riskyPhrases.length > 0 ? (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Compliance flagged
              {riskyPhrases.length > 0 ? `: ${riskyPhrases.join(", ")}` : ""}. Edit before copying or posting.
            </p>
          ) : null}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-4 w-full rounded-lg border px-3 py-2 text-sm font-medium"
            placeholder="Post title"
          />
          <textarea
            value={body}
            onChange={(event) => {
              const next = event.target.value;
              setBody(next);
              const risky = detectRiskyPhrasesClient(next);
              setRiskyPhrases(risky);
              setComplianceStatus(risky.length > 0 ? "flagged" : complianceStatus === "approved" ? "approved" : "needs_review");
            }}
            rows={12}
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm leading-6"
            placeholder="Post body"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={loading} onClick={() => void saveEdits()} className="rounded-lg border px-3 py-1.5 text-sm">
              Save edits
            </button>
            <button type="button" disabled={loading} onClick={() => void runAction("review")} className="rounded-lg border px-3 py-1.5 text-sm">
              Mark reviewed
            </button>
            <button
              type="button"
              disabled={loading || riskyPhrases.length > 0 || complianceStatus === "flagged"}
              onClick={() => void runAction("copy")}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Copy to clipboard
            </button>
            <button type="button" disabled={loading} onClick={() => void runAction("archive")} className="rounded-lg border px-3 py-1.5 text-sm text-amber-800">
              Archive
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Copy manually to LinkedIn or X — iCapOS does not post on your behalf.</p>
        </section>
      )}

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
