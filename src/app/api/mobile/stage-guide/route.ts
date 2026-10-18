// GET /api/mobile/stage-guide?slug=onboarding|preparation|marketing|closing  (Authorization: Bearer <supabase access token>)
// The stage guide (default preparation) for the phone: the same data /founder/stages/preparation
// renders, as JSON. Mirrors that page step for step. Read only.
import { NextResponse } from "next/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getStageGuide, STAGE_SLUGS, type StageGuide, type StageSlug } from "@/lib/founder/stage-guides";
import { crrFor } from "@/lib/crr/crr-for";
import type { CrrSummary } from "@/lib/crr/blocker";
import { computeStageProgress } from "@/lib/founder/stage-progress";
import { applyStepMemory } from "@/lib/founder/stage-step-memory";
import { getStageGateStatus } from "@/lib/founder/stage-gate-status";
import { loadOutreachStatus } from "@/lib/founder/outreach-status";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withBearerFounder } from "../_bearer";

export const dynamic = "force-dynamic";


export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("slug") ?? "preparation";
  if (!(STAGE_SLUGS as readonly string[]).includes(raw)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
  const SLUG = raw as StageSlug;
  const result = await withBearerFounder(req, async ({ profile }) => {
    const guide = getStageGuide(SLUG) as StageGuide;
    const { company } = await getActiveCompanyForUser(profile);
    const supabase = await createServerSupabaseClient();

    let progress: { overall: number | null; steps: Record<string, unknown> } = { overall: null, steps: {} };
    let crrSummary: CrrSummary | null = null;
    if (company) {
      const engineCrr = await crrFor(company.id).catch(() => null);
      crrSummary = engineCrr
        ? {
            score: engineCrr.score,
            gate: engineCrr.gate,
            pointsToGate: engineCrr.pointsToGate,
            outreachUnlocked: engineCrr.outreachUnlocked,
            dimensions: engineCrr.dimensions.map((d) => ({ label: d.label, score: d.score, weight: d.weight, headroom: d.headroom })),
          }
        : null;
      const raw = await computeStageProgress(supabase, company, SLUG, profile.id);
      progress = await applyStepMemory(company.id, guide, raw);
    }
    // Stage 3 needs the outreach status for its checklist and the manual outreach banner, as the website page does.
    const outreach = SLUG === "marketing" && company ? await loadOutreachStatus(company.id).catch(() => null) : null;
    const [gate, journey] = await Promise.all([
      getStageGateStatus(supabase, profile.id, SLUG, crrSummary, outreach).catch(() => null),
      evaluateFounderJourney(supabase, profile.id).catch(() => null),
    ]);
    // The website shows the Marketplace row only for Reg CF companies (offering_type), same check as its sidebar.
    let regCf = false;
    if (SLUG === "marketing" && company) {
      const admin = createServiceRoleClient() as unknown as SupabaseClient;
      const { data: oc } = await admin.from("companies").select("offering_type").eq("id", company.id).maybeSingle();
      regCf = (oc as { offering_type?: string } | null)?.offering_type === "reg_cf";
    }
    const guideIdx = (STAGE_SLUGS as readonly string[]).indexOf(SLUG);
    const inThisStage = journey ? journey.stageIndex === guideIdx : false;
    const showManualOutreachBanner = SLUG === "marketing" && inThisStage && outreach !== null && !outreach.manual.started;

    return {
      guide: {
        stageLabel: guide.stageLabel,
        title: guide.title,
        intro: guide.intro,
        steps: guide.steps.map((s) => ({
          title: s.title,
          desc: s.desc,
          href: s.href,
          hrefLabel: s.hrefLabel,
          openHref: s.openHref ?? s.href,
          aiLabel: s.ai.kind === "tool" ? s.ai.label : null,
          aiHref: s.ai.kind === "tool" ? s.ai.href : null,
          doneOnVisit: Boolean(s.doneOnVisit),
        })),
      },
      stageNumber: guideIdx + 1,
      nextStageSlug: (STAGE_SLUGS as readonly string[])[guideIdx + 1] ?? null,
      showManualOutreachBanner,
      regCf,
      progress,
      gate,
    };
  });
  if (!result.ok) return NextResponse.json({ error: "unauthorized" }, { status: result.status });
  return NextResponse.json(result.value, { headers: { "Cache-Control": "no-store" } });
}
