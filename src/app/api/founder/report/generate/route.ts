import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { writeAuditLog } from "@/lib/data/audit";
import {
  FOUNDER_REPORT_COOLDOWN_MS,
  generateAndSaveDiligenceReport,
  msUntilNextAllowedGeneration,
} from "@/lib/reports/generate-and-save";

/**
 * Founder self-serve diligence report generation.
 *
 * A founder can only ever generate for their OWN company: the company id comes
 * from their membership, never from the request body, so there is nothing to
 * tamper with. Generation calls a paid AI model, so it's capped at one run per
 * company per 24h (DB-backed, survives cold starts) plus a short in-memory
 * burst guard. Staff can still regenerate at will via POST /api/ai/reports.
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

    const company = await ensureFounderCompanyForUser(profile);
    if (!company) {
      return NextResponse.json(
        { error: "Complete company onboarding before generating a report." },
        { status: 400 },
      );
    }

    const admin = createServiceRoleClient();

    const waitMs = await msUntilNextAllowedGeneration(admin, company.id);
    if (waitMs > 0) {
      const hours = Math.ceil(waitMs / (60 * 60 * 1000));
      return NextResponse.json(
        {
          error: `You generated a report recently. You can generate a new one in about ${hours} hour${hours === 1 ? "" : "s"}.`,
          retryAfterMs: waitMs,
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil(waitMs / 1000)) } },
      );
    }

    const result = await generateAndSaveDiligenceReport(admin, company.id);

    await writeAuditLog(admin, {
      userId: profile.id,
      action: "diligence_report.created",
      entityType: "diligence_report",
      entityId: String(result.report.id),
      metadata: { companyId: company.id, initiatedBy: "founder" },
    });

    return NextResponse.json({
      ...result,
      cooldownMs: FOUNDER_REPORT_COOLDOWN_MS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
