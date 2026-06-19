import type { ReactNode } from "react";
import Link from "next/link";
import type { JourneyStage } from "@/lib/founder-journey/types";
import { checkFounderStageAccess } from "@/lib/founder-journey/stage-gate";

function getLockTitle(
  stage: JourneyStage,
  minRequired: JourneyStage,
  pendingApproval: boolean,
): string {
  if (stage === "initialize") {
    return "Complete your profile to continue";
  }
  if (stage === "qualify") {
    if (pendingApproval) {
      return "Approval pending — we'll notify you when ready";
    }
    return "Complete Qualify requirements to unlock this";
  }
  if (minRequired === "deploy") {
    return "Reach Deploy stage to access this feature";
  }
  return `Reach ${minRequired} stage to access this feature`;
}

function getLockDescription(stage: JourneyStage, minRequired: JourneyStage): string {
  if (stage === "initialize") {
    return "Finish setting up your founder profile to advance to the Qualify stage and unlock this feature.";
  }
  if (stage === "qualify") {
    return "Upload required documents and achieve a qualifying readiness score to request admin review and advance to Deploy.";
  }
  return `This feature is available at the ${minRequired} stage. Complete the requirements on your journey page to advance.`;
}

export async function FounderJourneyGate({
  minStage,
  children,
}: {
  minStage: JourneyStage;
  children: ReactNode;
}) {
  const result = await checkFounderStageAccess(minStage);

  if (result.allowed) {
    return <>{children}</>;
  }

  const { stage, minRequired, pendingApproval } = result;
  const title = getLockTitle(stage, minRequired, pendingApproval);
  const description = getLockDescription(stage, minRequired);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-indigo-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Link
        href="/founder/journey"
        className="mt-5 inline-block rounded-full border border-indigo-200 bg-indigo-50 px-5 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
      >
        View your journey
      </Link>
    </div>
  );
}
