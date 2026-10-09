import { NextResponse } from "next/server";
import { gateAiRun } from "@/lib/ai-usage/gate";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { writeAuditLog } from "@/lib/data/audit";
import { generateAndSaveDiligenceReport } from "@/lib/reports/generate-and-save";
import { getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { FREE_REPORT_LIMIT_MESSAGE, UPGRADE_BASIC_HREF, freeReportLimitReached, isRestrictedFreeFounder } from "@/lib/founder-plan/tier";

/**
 * Founder self-serve diligence report generation.
 *
 * A founder can only ever generate for their OWN company: the company id comes
 * from their membership, never from the request body, so there is nothing to
 * tamper with. Generation calls a paid AI model, so it's protected by a short
 * in-memory burst guard (a few runs per hour) — but founders may regenerate
 * freely within 24h so they can iterate as they improve their materials.
 * Staff can also regenerate at will via POST /api/ai/reports.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const profile = await requireRole(["founder"]);

    const burst = await enforceRateLimit({
      bucket: "founder-report-generate",
      subjectId: profile.id,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (burst) return burst as NextResponse;

    const { company } = await getActiveCompanyForUser(profile);
    if (!company) {
      return NextResponse.json(
        { error: "Complete company onboarding before generating a report." },
        { status: 400 },
      );
    }

    const admin = createServiceRoleClient();

    // One free report: a non grandfathered Free founder who already has a
    // diligence report upgrades to run it again. Grandfathered and paid
    // founders are unchanged.
    const subscription = await getSubscriptionForProfile(profile.id).catch(() => null);
    if (isRestrictedFreeFounder(subscription)) {
      const { count } = await admin
        .from("diligence_reports")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id);
      if (freeReportLimitReached(subscription, count ?? 0)) {
        return NextResponse.json(
          { error: FREE_REPORT_LIMIT_MESSAGE, code: "free_report_used", upgradeHref: UPGRADE_BASIC_HREF },
          { status: 403 },
        );
      }
    }

    // No 24h cooldown — founders may regenerate within the day (still guarded by
    // the per-hour burst limit above) so they can iterate on their materials.
    // Per-plan run cap (Admin, Feature Controls, AI usage limits).
    const aiRun = await gateAiRun(profile.id, "diligence_report");
    if (aiRun.blocked) return aiRun.blocked as NextResponse;
    const result = await generateAndSaveDiligenceReport(admin, company.id);
    await aiRun.done();

    await writeAuditLog(admin, {
      userId: profile.id,
      action: "diligence_report.created",
      entityType: "diligence_report",
      entityId: String(result.report.id),
      metadata: { companyId: company.id, initiatedBy: "founder" },
    });

    return NextResponse.json({
      ...result,
      cooldownMs: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed.";
    console.error("[founder-report] generation failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
