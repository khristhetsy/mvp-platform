// GET /api/mobile/onboarding  (Authorization: Bearer ...)
// Onboarding progress for the phone's progress card: the same data the website's
// /founder/onboarding progress card reads. Read only (it also runs the same
// progress sync the website page runs when it loads).
import { NextResponse } from "next/server";
import { loadFounderOnboardingPageData } from "@/lib/onboarding/load-founder-onboarding";
import { ONBOARDING_STEPS } from "@/lib/onboarding/progress";
import { withBearerFounder } from "../_bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const result = await withBearerFounder(req, async ({ profile }) => {
    const data = await loadFounderOnboardingPageData(profile);
    if (!data) return null;
    const { progress } = data;
    return {
      companyName: data.company.company_name,
      percent: progress.percent,
      isComplete: progress.isComplete,
      currentStep: progress.currentStep,
      steps: ONBOARDING_STEPS.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        completed: progress.steps[s.id].completed,
      })),
    };
  });
  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  if (!result.value) return NextResponse.json({ error: "no company" }, { status: 404 });
  return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } });
}
