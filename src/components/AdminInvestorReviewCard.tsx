"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatUsd } from "@/lib/ui/format-display";
import { investorApprovalStatusLabel } from "@/lib/investor/access";
import { KYC_STATUS_LABELS, type KycReviewItem } from "@/lib/investor/kyc";
import type { InvestorKycStatus, InvestorPriorDealRecord, InvestorProfileRecord } from "@/lib/investor/types";

type Row = InvestorProfileRecord & {
  profiles: { id: string; full_name: string | null; email: string | null; created_at: string } | null;
  matchingSummary?: { highMatchCompanyCount: number; topMatchScore: number };
  kycReview?: { items: KycReviewItem[]; canSubmit: boolean };
  priorDeals?: InvestorPriorDealRecord[];
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return formatUsd(value);
}

export function AdminInvestorReviewCard({ row }: Readonly<{ row: Row }>) {
  const t = useTranslations("sharedCmp");
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(row.admin_feedback ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState(row.approval_status);
  const [kycStatus, setKycStatus] = useState<InvestorKycStatus>(row.kyc_status);
  const [accredited, setAccredited] = useState(row.accreditation_verified);
  const [drafting, setDrafting] = useState(false);
  const [draftIntent, setDraftIntent] = useState<"approve" | "changes_requested" | "reject">("approve");
  const [sendToInvestor, setSendToInvestor] = useState(true);
  const [reopen, setReopen] = useState(false);
  // Once a profile is decided, collapse the decision UI so it doesn't look
  // like it still needs review. "changes_requested" stays open (awaiting resubmit).
  const resolved = status === "approved" || status === "rejected";

  async function setAccreditation(verified: boolean) {
    setLoading("accreditation");
    setError(null);
    const res = await fetch(`/api/admin/investor-kyc/${row.id}/accreditation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified }),
    });
    setLoading(null);
    if (!res.ok) {
      setError("Could not update accreditation.");
      return;
    }
    setAccredited(verified);
    router.refresh();
  }

  async function setDealVerified(dealId: string, verified: boolean) {
    setLoading(`deal-${dealId}`);
    setError(null);
    const res = await fetch(`/api/admin/prior-deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified }),
    });
    setLoading(null);
    if (!res.ok) {
      setError("Could not update deal verification.");
      return;
    }
    router.refresh();
  }

  async function reviewKyc(action: "verify" | "reject") {
    setLoading(`kyc_${action}`);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/admin/investor-kyc/${row.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, feedback: feedback.trim() || undefined }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string; investorProfile?: Row } | null;
    setLoading(null);

    if (!response.ok) {
      setError(body?.error ?? "KYC review failed.");
      return;
    }
    if (body?.investorProfile) setKycStatus(body.investorProfile.kyc_status);
    setSuccess(`Verification ${action === "verify" ? "approved" : "rejected"}.`);
    router.refresh();
  }

  async function generateDraft() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/investors/${row.id}/message-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: draftIntent, feedback: feedback.trim() || undefined }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "Could not draft a message.");
        return;
      }
      if (body?.message) setFeedback(body.message);
    } catch {
      setError("Could not draft a message.");
    } finally {
      setDrafting(false);
    }
  }

  async function review(action: "approve" | "reject" | "changes_requested") {
    setLoading(action);
    setError(null);
    setSuccess(null);

    const trimmed = feedback.trim();
    const response = await fetch(`/api/admin/investors/${row.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        feedback: trimmed || undefined,
        message: trimmed || undefined,
        send: sendToInvestor && Boolean(trimmed),
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; investorProfile?: Row; emailSent?: boolean; emailError?: string | null; notified?: boolean }
      | null;
    setLoading(null);

    if (!response.ok) {
      setError(body?.error ?? "Review action failed.");
      return;
    }

    if (body?.investorProfile) {
      setStatus(body.investorProfile.approval_status);
    }

    let sentNote = "";
    if (body?.notified) {
      sentNote = body.emailSent
        ? " Email + in-app notification sent."
        : ` Notified in-app${body.emailError ? ` (email not sent: ${body.emailError})` : ""}.`;
    }
    setSuccess(`Investor ${action.replaceAll("_", " ")} recorded.${sentNote}`);
    router.refresh();
  }

  const investorName = row.profiles?.full_name ?? row.profiles?.email ?? "Investor";

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{row.investor_type ?? "Type not set"}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{investorName}</h2>
          {row.profiles?.email ? <p className="text-sm text-slate-600">{row.profiles.email}</p> : null}
          {row.firm_name ? <p className="mt-1 text-sm text-slate-600">Firm: {row.firm_name}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
          {investorApprovalStatusLabel(status)}
        </span>
      </div>

      {row.matchingSummary ? (
        <p className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          Marketplace match quality: <strong>{row.matchingSummary.highMatchCompanyCount}</strong> companies ≥70% ·
          best score <strong>{row.matchingSummary.topMatchScore}%</strong>
        </p>
      ) : null}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Check size</dt>
          <dd className="font-medium text-slate-900">
            {formatMoney(row.check_size_min)} – {formatMoney(row.check_size_max)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Submitted</dt>
          <dd className="font-medium text-slate-900">{formatDate(row.submitted_at)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Sectors</dt>
          <dd className="font-medium text-slate-900">{row.preferred_sectors.join(", ") || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Geographies</dt>
          <dd className="font-medium text-slate-900">{row.preferred_geographies.join(", ") || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Stages</dt>
          <dd className="font-medium text-slate-900">{row.preferred_stages.join(", ") || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Accredited self-attestation</dt>
          <dd className="font-medium text-slate-900">{row.accredited_status ? "Yes" : "No"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Investment thesis</dt>
          <dd className="mt-1 leading-6 text-slate-800">{row.investment_thesis ?? "—"}</dd>
        </div>
      </dl>

      {status === "approved" ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("stage_2_kyc_verification")}</p>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {KYC_STATUS_LABELS[kycStatus]}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {(row.kycReview?.items ?? []).map((item) => (
              <li key={item.code} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">
                  {item.label}
                  {item.required ? "" : " (optional)"}
                </span>
                {item.uploaded && item.signedUrl ? (
                  <a href={item.signedUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:text-indigo-500">
                    View ↗
                  </a>
                ) : item.uploaded ? (
                  <span className="text-slate-500">{t("uploaded")}</span>
                ) : (
                  <span className="text-slate-400">{t("not_uploaded")}</span>
                )}
              </li>
            ))}
            {(row.kycReview?.items ?? []).length === 0 ? (
              <li className="text-sm text-slate-400">{t("no_documents_uploaded_yet")}</li>
            ) : null}
          </ul>

          {/* Accreditation (optional, boosts the investor's score when verified) */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-600">
              Accreditation evidence ·{" "}
              <span className={accredited ? "font-medium text-emerald-700" : "text-slate-400"}>
                {accredited ? "Verified" : "Not verified"}
              </span>
            </span>
            <button
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              disabled={Boolean(loading)}
              onClick={() => setAccreditation(!accredited)}
            >
              {accredited ? "Unverify" : "Verify accreditation"}
            </button>
          </div>

          {/* Prior deals — verify each individually */}
          {(row.priorDeals ?? []).length > 0 ? (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("prior_deals")}</p>
              <ul className="space-y-1.5">
                {(row.priorDeals ?? []).map((deal) => (
                  <li key={deal.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">
                      {deal.company_name}
                      <span className="text-slate-400">
                        {" "}
                        · {[deal.stage, deal.year].filter(Boolean).join(" ") || "—"}
                        {deal.proof_document_id ? "" : " · no proof"}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                        deal.verified ? "border-emerald-300 text-emerald-700" : "border-slate-300 text-slate-700"
                      }`}
                      disabled={Boolean(loading)}
                      onClick={() => setDealVerified(deal.id, !deal.verified)}
                    >
                      {deal.verified ? "Verified ✓" : "Verify"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {kycStatus !== "verified" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                disabled={Boolean(loading) || kycStatus === "not_started"}
                onClick={() => reviewKyc("verify")}
              >
                Verify
              </button>
              <button
                type="button"
                className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-800 disabled:opacity-50"
                disabled={Boolean(loading) || kycStatus === "not_started"}
                onClick={() => reviewKyc("reject")}
              >
                Reject verification
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {resolved && !reopen ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">
            {status === "approved" ? "✓ Approved" : "Rejected"}
            {status === "approved" && row.approved_at ? ` on ${formatDate(row.approved_at)}` : ""}
            {" · no further review needed."}
          </p>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            onClick={() => setReopen(true)}
          >
            Change decision or send a message
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message to investor</span>
            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                value={draftIntent}
                disabled={drafting || Boolean(loading)}
                onChange={(event) => setDraftIntent(event.target.value as "approve" | "changes_requested" | "reject")}
                aria-label="Message tone"
              >
                <option value="approve">Approval — warm</option>
                <option value="changes_requested">Request changes</option>
                <option value="reject">Rejection</option>
              </select>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                disabled={drafting || Boolean(loading)}
                onClick={() => void generateDraft()}
              >
                {drafting ? "Drafting…" : "✦ Generate with AI"}
              </button>
            </div>
          </div>

          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Write a message, or generate one with AI. Required when rejecting or requesting changes."
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />

          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={sendToInvestor}
              onChange={(event) => setSendToInvestor(event.target.checked)}
            />
            Email + notify the investor with this message when I record the decision
          </label>

          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              disabled={Boolean(loading)}
              onClick={() => review("approve")}
            >
              {loading === "approve" ? "Approving…" : sendToInvestor && feedback.trim() ? "Approve & send" : "Approve"}
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50"
              disabled={Boolean(loading)}
              onClick={() => review("changes_requested")}
            >
              Request changes
            </button>
            <button
              type="button"
              className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-800 disabled:opacity-50"
              disabled={Boolean(loading)}
              onClick={() => review("reject")}
            >
              Reject
            </button>
          </div>
        </>
      )}
    </article>
  );
}
