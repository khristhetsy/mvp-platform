import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { FounderStageBanner } from "@/components/founder/FounderStageBanner";
import type { JourneyStage, FounderJourneyState } from "@/lib/founder-journey/types";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<JourneyStage, string> = {
  initialize: "Initialize",
  qualify: "Qualify",
  deploy: "Deploy",
  optimize: "Optimize",
};

const STAGE_DESCRIPTIONS: Record<JourneyStage, string> = {
  initialize: "Set up your founder profile and company details to get started on CapitalOS.",
  qualify:
    "Upload required documents, complete your readiness assessment, and request admin review to unlock investor access.",
  deploy:
    "Your company is live to investors. Build deal rooms, engage with interested parties, and raise your round.",
  optimize: "Manage your active raise, track investor conversations, and scale your investor relations.",
};

type StageStatus = "completed" | "active" | "locked";

function getStageStatus(stageIndex: number, currentIndex: number): StageStatus {
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "active";
  return "locked";
}

function StageStatusIcon({ status }: { status: StageStatus }) {
  if (status === "completed") {
    return (
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-emerald-600"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 ring-2 ring-indigo-300 ring-offset-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stage requirement rows
// ────────────────────────────────────────────────────────────────────────────

type Requirement = { label: string; met: boolean };

function getQualifyRequirements(state: FounderJourneyState): Requirement[] {
  return [
    { label: "Onboarding complete", met: state.conditions.onboardingComplete },
    { label: "Required documents uploaded (financials, cap table, pitch deck)", met: state.conditions.requiredDocsUploaded },
    { label: "Readiness score ≥ 75", met: state.conditions.readinessQualified },
  ];
}

function RequirementRow({ label, met }: Requirement) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {met ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 flex-shrink-0 text-emerald-500"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 flex-shrink-0 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
      <span className={met ? "text-slate-700" : "text-slate-500"}>{label}</span>
    </li>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Additional counts fetched for stage 4
// ────────────────────────────────────────────────────────────────────────────

type StageCounts = {
  dealRoomCount: number;
  investorInterestCount: number;
  onboardingPercent: number;
};

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default async function FounderJourneyPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const state = await evaluateFounderJourney(supabase, profile.id);

  // Fetch extra counts for the journey page display
  const counts: StageCounts = {
    dealRoomCount: 0,
    investorInterestCount: 0,
    onboardingPercent: 0,
  };

  if (company) {
    type CompanyRow = { onboarding_progress_percent: number | null };
    const companyResult = await supabase
      .from("companies")
      .select("onboarding_progress_percent")
      .eq("id", company.id)
      .maybeSingle();
    const companyRow = (companyResult as { data: CompanyRow | null }).data;
    counts.onboardingPercent = companyRow?.onboarding_progress_percent ?? 0;

    type CountRow = { id: string };

    const drResult = await supabase
      .from("deal_rooms")
      .select("id")
      .eq("company_id", company.id);
    const drRows = (drResult as { data: CountRow[] | null }).data ?? [];
    counts.dealRoomCount = drRows.length;

    const iiResult = await supabase
      .from("investor_interests")
      .select("id")
      .eq("company_id", company.id);
    const iiRows = (iiResult as { data: CountRow[] | null }).data ?? [];
    counts.investorInterestCount = iiRows.length;
  }

  const currentIndex = state.stageIndex;
  const qualifyRequirements = getQualifyRequirements(state);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <PageHeader
        eyebrow="Founder journey"
        title="Your CapitalOS Journey"
        description="Track your progress through each stage — from profile setup to active investor engagement."
      />

      {/* Stage timeline */}
      <div className="space-y-4">
        {JOURNEY_STAGES.map((stage, i) => {
          const status = getStageStatus(i, currentIndex);
          const isActive = status === "active";
          const label = STAGE_LABELS[stage];
          const description = STAGE_DESCRIPTIONS[stage];

          return (
            <div
              key={stage}
              className={[
                "rounded-2xl border p-6 transition-all",
                isActive
                  ? "border-indigo-200 bg-indigo-50/50"
                  : status === "completed"
                    ? "border-emerald-100 bg-emerald-50/30"
                    : "border-slate-200 bg-slate-50/50 opacity-70",
              ].join(" ")}
            >
              <div className="flex items-start gap-4">
                <StageStatusIcon status={status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "text-[10px] font-semibold uppercase tracking-widest",
                        isActive ? "text-indigo-400" : status === "completed" ? "text-emerald-500" : "text-slate-400",
                      ].join(" ")}
                    >
                      Stage {i + 1}
                    </span>
                    {isActive ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        Current
                      </span>
                    ) : null}
                    {status === "completed" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Completed
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-0.5 text-base font-semibold text-slate-900">{label}</h2>
                  <p className="mt-1 text-sm text-slate-600">{description}</p>

                  {/* Qualify-specific details */}
                  {stage === "qualify" && (isActive || status === "completed") ? (
                    <div className="mt-4 space-y-3">
                      <ul className="space-y-1.5">
                        {qualifyRequirements.map((req) => (
                          <RequirementRow key={req.label} label={req.label} met={req.met} />
                        ))}
                      </ul>

                      {state.conditions.readinessScore !== null ? (
                        <p className="text-sm text-slate-600">
                          Readiness score:{" "}
                          <span
                            className={[
                              "font-semibold",
                              state.conditions.readinessQualified ? "text-emerald-600" : "text-amber-600",
                            ].join(" ")}
                          >
                            {state.conditions.readinessScore}
                          </span>
                          <span className="text-slate-400"> / 100</span>
                        </p>
                      ) : null}

                      {state.pendingApproval ? (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          Admin review is in progress. You will be notified when your stage is updated.
                        </p>
                      ) : null}

                      {state.approvalFeedback ? (
                        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                          Feedback: {state.approvalFeedback}
                        </p>
                      ) : null}

                      {isActive ? (
                        <div className="flex items-center gap-3">
                          <Link
                            href="/founder/qualify"
                            className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                          >
                            Open Qualify workspace →
                          </Link>
                          {state.canRequestApproval ? (
                            <span className="text-xs text-slate-500">
                              All requirements met — submit for admin review
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Deploy / Optimize stats */}
                  {(stage === "deploy" || stage === "optimize") && status !== "locked" ? (
                    <div className="mt-4 flex flex-wrap gap-4">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                        <p className="font-medium text-slate-900">{counts.dealRoomCount}</p>
                        <p className="text-slate-500">Deal room{counts.dealRoomCount !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                        <p className="font-medium text-slate-900">{counts.investorInterestCount}</p>
                        <p className="text-slate-500">Investor interest{counts.investorInterestCount !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Deploy workspace entry */}
                  {stage === "deploy" && isActive ? (
                    <div className="mt-4">
                      <Link
                        href="/founder/deploy"
                        className="inline-block rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                      >
                        Open Deploy workspace →
                      </Link>
                    </div>
                  ) : null}

                  {/* Optimize workspace entry */}
                  {stage === "optimize" && isActive ? (
                    <div className="mt-4">
                      <Link
                        href="/founder/optimize"
                        className="inline-block rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                      >
                        Open Optimize workspace →
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Banner + quick links */}
      <div className="mt-8 space-y-4">
        <FounderStageBanner state={state} onboardingPercent={counts.onboardingPercent} />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/founder/onboarding"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Company profile
          </Link>
          <Link
            href="/founder/documents"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Documents
          </Link>
          <Link
            href="/founder/deal-room"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Deal rooms
          </Link>
        </div>
      </div>
    </FounderAppShell>
  );
}
