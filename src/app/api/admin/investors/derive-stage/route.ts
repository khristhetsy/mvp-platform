/**
 * Derive operating stage from investor type. Staff-only, no AI, no cost.
 *   POST { op: "preview" }            → { plan (sample), total, byRule, scanned }
 *   POST { op: "apply" }              → { scanned, filled, byRule, errors, firstError, reindexed }
 *   POST { op: "undo", ruleId }       → { removed }
 * See src/lib/investors/derive-stage.ts for the rules and why they are safe.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { planStageDerivation, applyStageDerivation, undoStageRule, summarise, STAGE_RULES } from "@/lib/investors/derive-stage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  op: z.enum(["preview", "apply", "undo"]),
  ruleId: z.string().max(60).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (parsed.data.op === "preview") {
    const { plan, scanned } = await planStageDerivation();
    return NextResponse.json({
      plan: plan.slice(0, 200),   // sample for the table; counts describe the whole plan
      total: plan.length,
      scanned,
      byRule: summarise(plan),
      rules: STAGE_RULES.map((r) => ({ id: r.id, label: r.label, stages: r.stages })),
    });
  }
  if (parsed.data.op === "undo") {
    const ruleId = parsed.data.ruleId;
    if (!ruleId || !STAGE_RULES.some((r) => r.id === ruleId)) {
      return NextResponse.json({ error: "Unknown rule." }, { status: 400 });
    }
    return NextResponse.json({ removed: await undoStageRule(ruleId) });
  }
  return NextResponse.json(await applyStageDerivation());
}
