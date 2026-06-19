import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import {
  QUALIFY_REQUIRED_DOCUMENTS,
  isQualifyDocSatisfied,
} from "@/lib/founder-journey/documents";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { QualifySubmitButton } from "@/components/founder/QualifySubmitButton";

export const dynamic = "force-dynamic";

const READINESS_THRESHOLD = 75;

type UploadedDoc = {
  document_type: string | null;
  file_name: string | null;
  created_at: string | null;
};

function CheckIcon() {
  return (
    <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-5 w-5 text-slate-300"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />
    </svg>
  );
}

export default async function FounderQualifyPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const state = await evaluateFounderJourney(supabase, profile.id);

  // Per-document status for the checklist.
  let uploadedDocs: UploadedDoc[] = [];
  {
    const result = await supabase
      .from("documents")
      .select("document_type, file_name, created_at")
      .eq("uploaded_by", profile.id);
    const { data } = result as { data: UploadedDoc[] | null };
    uploadedDocs = data ?? [];
  }

  const uploadedTypes = uploadedDocs.map((d) => d.document_type);
  const checklist = QUALIFY_REQUIRED_DOCUMENTS.map((doc) => {
    const satisfied = isQualifyDocSatisfied(uploadedTypes, doc);
    const match = uploadedDocs.find((u) =>
      isQualifyDocSatisfied([u.document_type], doc),
    );
    return { doc, satisfied, fileName: match?.file_name ?? null };
  });

  const readinessScore = state.conditions.readinessScore;
  const readinessQualified = state.conditions.readinessQualified;
  const meterValue = Math.max(0, Math.min(100, readinessScore ?? 0));
  const missingDocs = checklist.filter((row) => !row.satisfied);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderJourneyGate minStage="qualify">
        <div className="mb-4">
          <Link
            href="/founder/journey"
            className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            ← Founder journey
          </Link>
        </div>

        <PageHeader
          eyebrow="Stage 2 · Qualify"
          title="Prove you're investor-ready"
          description="Upload your due-diligence materials and reach the readiness threshold, then submit for admin review to unlock Deploy."
        />

        {/* Readiness meter */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-slate-600">Readiness score</h2>
            <p className="text-sm text-slate-500">
              Target <span className="font-semibold text-slate-900">{READINESS_THRESHOLD}%</span> to submit
            </p>
          </div>

          {readinessScore === null ? (
            <div className="mt-3">
              <p className="text-sm text-slate-600">
                Your readiness hasn&apos;t been assessed yet.{" "}
                <Link href="/founder/readiness" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Run your readiness assessment →
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span
                  className={[
                    "text-3xl font-semibold",
                    readinessQualified ? "text-emerald-600" : "text-amber-600",
                  ].join(" ")}
                >
                  {Math.round(readinessScore)}%
                </span>
                <span className="text-sm text-slate-500">
                  {readinessQualified
                    ? "Threshold met"
                    : `${Math.max(0, READINESS_THRESHOLD - Math.round(readinessScore))}% to go`}
                </span>
              </div>
              <div className="relative mt-3 h-2.5 rounded-full bg-slate-100">
                <div
                  className={[
                    "absolute left-0 top-0 h-2.5 rounded-full",
                    readinessQualified ? "bg-emerald-500" : "bg-amber-500",
                  ].join(" ")}
                  style={{ width: `${meterValue}%` }}
                />
                <div
                  className="absolute top-[-3px] h-[16px] w-0.5 bg-slate-900"
                  style={{ left: `${READINESS_THRESHOLD}%` }}
                  aria-hidden="true"
                />
              </div>
              {!readinessQualified ? (
                <Link
                  href="/founder/readiness"
                  className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Improve your readiness score →
                </Link>
              ) : null}
            </>
          )}
        </section>

        {/* Required documents */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-slate-900">Required documents</h2>
          <ul className="space-y-2">
            {checklist.map(({ doc, satisfied, fileName }) => (
              <li
                key={doc.code}
                className={[
                  "flex items-center gap-3 rounded-xl border p-4",
                  satisfied ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/60",
                ].join(" ")}
              >
                <span className="flex-shrink-0">{satisfied ? <CheckIcon /> : <UploadIcon />}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{doc.label}</p>
                  {satisfied ? (
                    <p className="truncate text-xs text-slate-500">{fileName ?? "Uploaded"}</p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Not uploaded ·{" "}
                      <Link href="/founder/learning" className="text-indigo-600 hover:text-indigo-500">
                        {doc.learningTopic}
                      </Link>
                    </p>
                  )}
                </div>
                {satisfied ? (
                  <span className="flex-shrink-0 text-xs font-medium text-emerald-600">Done</span>
                ) : (
                  <Link
                    href="/founder/documents"
                    className="flex-shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    Upload
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Submit for review */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          {state.pendingApproval ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Your submission is in admin review. We&apos;ll notify you when your stage is updated.
            </div>
          ) : state.approvalFeedback ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                Changes requested: {state.approvalFeedback}
              </div>
              {state.canRequestApproval ? <QualifySubmitButton /> : null}
            </div>
          ) : state.canRequestApproval ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-600">
                All requirements met — submit for admin review to advance to Deploy.
              </p>
              <QualifySubmitButton />
            </div>
          ) : (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900">Not ready to submit yet</p>
              <ul className="mt-2 space-y-1 text-slate-500">
                {!readinessQualified ? (
                  <li>• Reach a readiness score of {READINESS_THRESHOLD}%.</li>
                ) : null}
                {missingDocs.map((row) => (
                  <li key={row.doc.code}>• Upload your {row.doc.label.toLowerCase()}.</li>
                ))}
                {!state.conditions.onboardingComplete ? (
                  <li>• Complete your company profile in Initialize.</li>
                ) : null}
              </ul>
            </div>
          )}
        </section>
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
