"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminSubscriptionSummary } from "@/components/AdminSubscriptionSummary";
import { useAdminActionHealthSafe } from "@/components/AdminActionHealthProvider";
import { CompanyStatusBadge } from "@/components/CompanyStatusBadge";
import type { PlanType, SubscriptionRecord } from "@/lib/subscriptions/plans";
import { formatApiError } from "@/lib/api/errors";
import { adminDebug } from "@/lib/debug/admin-debug";

export type AdminCompanyCardData = {
  id: string;
  company_name: string;
  industry: string | null;
  review_status: string | null;
  is_published: boolean;
  marketplace_visible: boolean;
  published_at: string | null;
  slug: string | null;
  business_description: string | null;
  created_at: string;
  founder_name: string;
  founder_email: string;
  pitch_deck_url: string | null;
  pitch_deck_id: string | null;
  documents: Array<{
    id: string;
    file_name: string | null;
    document_type: string | null;
    created_at: string;
  }>;
  initial_feedback: string;
  founder_subscription: SubscriptionRecord | null;
  founder_requested_plan: PlanType | null;
  founder_onboarding_percent: number;
  founder_onboarding_completed_at: string | null;
  founder_remediation_active: number;
  founder_remediation_total: number;
  founder_learning_percent: number;
  founder_learning_milestone: string;
  founder_learning_modules_engaged: number;
};

type Props = {
  company: AdminCompanyCardData;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function AdminCompanyCard({ company }: Props) {
  const router = useRouter();
  const { recordAction, recordApiResult } = useAdminActionHealthSafe();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [lastResponseBody, setLastResponseBody] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(company.initial_feedback);
  const [showCompanyDetails, setShowCompanyDetails] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState<"reject" | "changes_requested" | null>(null);
  const [reviewStatus, setReviewStatus] = useState(company.review_status);
  const [isPublished, setIsPublished] = useState(company.is_published);
  const [marketplaceVisible, setMarketplaceVisible] = useState(company.marketplace_visible);
  const [publishedAt, setPublishedAt] = useState(company.published_at);

  useEffect(() => {
    setReviewStatus(company.review_status);
    setIsPublished(company.is_published);
    setMarketplaceVisible(company.marketplace_visible);
    setPublishedAt(company.published_at);
    setFeedback(company.initial_feedback);
  }, [
    company.id,
    company.review_status,
    company.is_published,
    company.marketplace_visible,
    company.published_at,
    company.initial_feedback,
  ]);

  async function callApi(action: string, path: string, body: Record<string, unknown>) {
    recordAction({
      lastButtonClicked: action,
      lastApiUrl: path,
      lastHttpStatus: null,
      lastResponseBody: null,
      lastErrorMessage: null,
    });

    adminDebug({
      scope: "AdminCompanyCard.callApi",
      action,
      companyId: company.id,
      slug: company.slug,
      path,
      payload: body,
    });

    let response: Response;

    try {
      response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Network request failed.";
      recordApiResult({
        button: action,
        url: path,
        status: 0,
        body: { error: message },
        errorMessage: message,
      });
      adminDebug({
        scope: "AdminCompanyCard.callApi",
        action,
        companyId: company.id,
        path,
        exception,
      });
      throw exception;
    }

    const raw = await response.text();
    let payload: Record<string, unknown> = {};

    if (raw) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        payload = { error: raw.trim() || `Request failed (${response.status}).` };
      }
    }

    const responseBody = raw || JSON.stringify(payload, null, 2);
    const errorMessage = response.ok ? null : formatApiError(payload, `Request failed (${response.status}).`);

    recordApiResult({
      button: action,
      url: path,
      status: response.status,
      body: payload,
      errorMessage,
    });

    setLastResponseBody(responseBody);

    adminDebug({
      scope: "AdminCompanyCard.callApi",
      action,
      companyId: company.id,
      slug: company.slug,
      path,
      status: response.status,
      response: payload,
      error: errorMessage,
    });

    if (!response.ok) {
      const apiError = new Error(errorMessage ?? `Request failed (${response.status}).`);
      (apiError as Error & { status?: number }).status = response.status;
      throw apiError;
    }

    return payload;
  }

  function failAction(actionKey: string, message: string) {
    recordAction({
      lastButtonClicked: actionKey,
      lastApiUrl: null,
      lastHttpStatus: null,
      lastResponseBody: null,
      lastErrorMessage: message,
    });
    setError(message);
    setErrorStatus(null);
    setSuccess(null);
    setLastResponseBody(null);
  }

  async function runAction(actionKey: string, fn: () => Promise<void>) {
    setLoading(actionKey);
    setError(null);
    setErrorStatus(null);
    setSuccess(null);
    setLastResponseBody(null);

    recordAction({ lastButtonClicked: actionKey });

    try {
      await fn();
      setSuccess("Saved successfully.");
      router.refresh();
    } catch (caught) {
      const status = caught instanceof Error ? (caught as Error & { status?: number }).status ?? null : null;
      const message = caught instanceof Error ? caught.message : "Action failed.";
      setErrorStatus(status);
      setError(status ? `[HTTP ${status}] ${message}` : message);
      adminDebug({
        scope: "AdminCompanyCard.runAction",
        action: actionKey,
        companyId: company.id,
        slug: company.slug,
        status: status ?? undefined,
        exception: caught,
      });
    } finally {
      setLoading(null);
    }
  }

  async function submitReview(action: "approve" | "reject" | "changes_requested") {
    if (action === "approve" && reviewStatus === "approved") {
      failAction("Approve", "Company is already approved. Use Publish or Unpublish for marketplace visibility.");
      return;
    }

    if ((action === "reject" || action === "changes_requested") && reviewStatus === "rejected") {
      failAction(action, "Company is already rejected.");
      return;
    }

    if ((action === "reject" || action === "changes_requested") && !feedback.trim()) {
      failAction(action, "Feedback is required before rejecting or requesting changes.");
      return;
    }

    await runAction(action, async () => {
      const payload = await callApi(action, `/api/admin/companies/${company.id}/review`, {
        action,
        feedback: action === "approve" ? undefined : feedback.trim(),
      });

      const updatedCompany = payload.company as { review_status?: string | null } | undefined;
      const updatedReview = payload.review as { status?: string | null } | undefined;

      const nextStatus =
        updatedCompany?.review_status ??
        updatedReview?.status ??
        (action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested");

      setReviewStatus(nextStatus);
      if (action === "approve") {
        setIsPublished(true);
        setMarketplaceVisible(true);
        setPublishedAt(new Date().toISOString());
      } else {
        setIsPublished(false);
        setMarketplaceVisible(false);
        if (action !== "changes_requested") {
          setPublishedAt(null);
        }
      }
      setShowFeedbackForm(null);
    });
  }

  async function toggleMarketplace(action: "publish" | "unpublish") {
    const isLiveOnMarketplace = isPublished && marketplaceVisible;

    if (action === "publish") {
      if (reviewStatus !== "approved") {
        failAction("Publish to Marketplace", "Company must be approved before publishing to the marketplace.");
        return;
      }
      if (isLiveOnMarketplace) {
        failAction("Publish to Marketplace", "Company is already live on the marketplace.");
        return;
      }
    }

    if (action === "unpublish" && !isLiveOnMarketplace) {
      failAction("Unpublish from Marketplace", "Company is not currently live on the marketplace.");
      return;
    }

    await runAction(action, async () => {
      const payload = await callApi(action, `/api/admin/companies/${company.id}/marketplace`, { action });
      const updated = payload.company as
        | {
            is_published?: boolean;
            marketplace_visible?: boolean;
            published_at?: string | null;
            review_status?: string | null;
          }
        | undefined;
      setIsPublished(Boolean(updated?.is_published));
      setMarketplaceVisible(Boolean(updated?.marketplace_visible));
      setPublishedAt(updated?.published_at ?? null);
      if (updated?.review_status) {
        setReviewStatus(updated.review_status);
      }
    });
  }

  async function saveFeedbackOnly() {
    if (!feedback.trim()) {
      failAction("Save Feedback", "Feedback cannot be empty.");
      return;
    }

    await runAction("save_feedback", async () => {
      await callApi("save_feedback", `/api/admin/companies/${company.id}/feedback`, {
        feedback: feedback.trim(),
      });
    });
  }

  async function openSignedDocument(documentId: string) {
    await runAction(`view_doc_${documentId}`, async () => {
      const payload = await callApi("view_document", "/api/documents/signed-url", { documentId });
      const signedUrl = payload.signedUrl as string | undefined;
      if (!signedUrl) {
        throw new Error("No signed URL returned.");
      }
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    });
  }

  async function viewPitchDeck() {
    recordAction({ lastButtonClicked: "View Pitch Deck" });

    if (company.pitch_deck_url) {
      window.open(company.pitch_deck_url, "_blank", "noopener,noreferrer");
      return;
    }

    if (!company.pitch_deck_id) {
      failAction("View Pitch Deck", "No pitch deck uploaded for this company.");
      return;
    }

    await openSignedDocument(company.pitch_deck_id);
  }

  const isBusy = Boolean(loading);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-500">{company.industry ?? "Industry not set"}</p>
            <CompanyStatusBadge
              reviewStatus={reviewStatus}
              isPublished={isPublished}
              marketplaceVisible={marketplaceVisible}
              publishedAt={publishedAt}
            />
          </div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{company.company_name}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {company.founder_name} · {company.founder_email}
          </p>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Founder onboarding</p>
            <p className="mt-2 text-xs text-slate-600">
              Progress: <strong>{company.founder_onboarding_percent}%</strong>
              {company.founder_onboarding_completed_at
                ? ` · Completed ${formatDate(company.founder_onboarding_completed_at)}`
                : " · In progress"}
            </p>
          </div>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Learning progression</p>
            <p className="mt-2 text-xs text-slate-600">
              Completion: <strong>{company.founder_learning_percent}%</strong> ·{" "}
              <strong>{company.founder_learning_modules_engaged}</strong> modules engaged
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Milestone: <strong>{company.founder_learning_milestone}</strong>
            </p>
          </div>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Remediation action plan</p>
            <p className="mt-2 text-xs text-slate-600">
              {company.founder_remediation_active > 0 ? (
                <>
                  <strong className="text-amber-800">{company.founder_remediation_active} active</strong> remediation
                  tasks · {company.founder_remediation_total} total tracked
                </>
              ) : (
                <>No active remediation tasks · {company.founder_remediation_total} total tracked</>
              )}
            </p>
          </div>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Founder subscription</p>
            <div className="mt-2">
              <AdminSubscriptionSummary
                subscription={company.founder_subscription}
                requestedPlan={company.founder_requested_plan}
              />
            </div>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {company.business_description ?? "No description provided."}
          </p>
          <p className="mt-2 text-xs text-slate-500">Submitted {formatDate(company.created_at)}</p>
        </div>

        <div className="flex flex-col gap-3">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">Action failed</p>
              <p className="mt-1 whitespace-pre-wrap">{error}</p>
              {errorStatus ? <p className="mt-1 text-xs text-red-600">HTTP status: {errorStatus}</p> : null}
              {lastResponseBody ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-red-950/90 p-2 text-xs text-red-100">
                  {lastResponseBody}
                </pre>
              ) : null}
            </div>
          ) : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

          {showFeedbackForm ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="min-h-24 w-full rounded-2xl border border-slate-300 p-3 text-sm"
                placeholder={
                  showFeedbackForm === "reject"
                    ? "Explain why this submission was rejected..."
                    : "Describe the changes the founder should make..."
                }
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void submitReview(showFeedbackForm)}
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading === showFeedbackForm ? "Saving..." : "Confirm"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setShowFeedbackForm(null)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setShowFeedbackForm("reject")}
                className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setShowFeedbackForm("changes_requested")}
                className="rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
              >
                Request Changes
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void submitReview("approve")}
                className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading === "approve" ? "Approving..." : "Approve"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void toggleMarketplace("publish")}
              className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading === "publish" ? "Publishing..." : "Publish to Marketplace"}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void toggleMarketplace("unpublish")}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {loading === "unpublish" ? "Unpublishing..." : "Unpublish from Marketplace"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setShowCompanyDetails((open) => !open)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {showCompanyDetails ? "Hide Company" : "View Company"}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setShowDocuments((open) => !open)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {showDocuments ? "Hide Documents" : "View Documents"}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void viewPitchDeck()}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {loading?.startsWith("view_doc") ? "Opening..." : "View Pitch Deck"}
            </button>
          </div>
        </div>
      </div>

      {showCompanyDetails ? (
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <p>
            <span className="font-semibold">Company ID:</span> {company.id}
          </p>
          <p className="mt-2">
            <span className="font-semibold">Review status:</span>{" "}
            <CompanyStatusBadge
              reviewStatus={reviewStatus}
              isPublished={isPublished}
              marketplaceVisible={marketplaceVisible}
              publishedAt={publishedAt}
            />
          </p>
          {company.slug ? (
            <p className="mt-2">
              <span className="font-semibold">Marketplace slug:</span> {company.slug}
            </p>
          ) : null}
          <p className="mt-2">
            <span className="font-semibold">Description:</span>{" "}
            {company.business_description ?? "No description provided."}
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Admin feedback</h3>
          <textarea
            className="mt-3 min-h-32 w-full rounded-2xl border border-slate-300 p-4 text-sm"
            placeholder="Add analyst or admin review notes..."
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void saveFeedbackOnly()}
            className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading === "save_feedback" ? "Saving..." : "Save Feedback"}
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Documents</h3>
          {showDocuments || company.documents.length <= 3 ? (
            <div className="mt-3 divide-y divide-slate-100">
              {company.documents.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">No documents uploaded.</p>
              ) : (
                company.documents.map((document) => (
                  <div key={document.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <span className="font-medium text-slate-800">
                        {document.file_name ?? document.document_type ?? "Document"}
                      </span>
                      <p className="text-slate-500">
                        {document.document_type ?? "—"} · {formatDate(document.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void openSignedDocument(document.id)}
                      className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Open
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {company.documents.length} documents uploaded. Click &quot;View Documents&quot; to expand.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
