/**
 * Derive missing investor criteria from investor type. Staff-only, no AI, no cost.
 *   POST { op: "preview" }                → { plan (sample), total, byRule, scanned, rules }
 *   POST { op: "apply" }                  → { scanned, contacts, fields, byRule, errors, reindexed }
 *   POST { op: "undo", ruleId, field }    → { removed }
 * See src/lib/investors/derive-from-type.ts for the rules and why they are safe.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { planDerivation, applyDerivation, undoDerivation, summarise, TYPE_RULES } from "@/lib/investors/derive-from-type";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  op: z.enum(["preview", "apply", "undo"]),
  ruleId: z.string().max(60).optional(),
  field: z.string().max(30).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (parsed.data.op === "preview") {
    const { plan, scanned } = await planDerivation();
    return NextResponse.json({
      total: plan.length,
      scanned,
      byRule: summarise(plan),
      rules: TYPE_RULES.map((r) => ({
        id: r.id, label: r.label,
        fills: r.fills.map((f) => ({ field: f.field, weight: f.weight, values: f.values })),
      })),
    });
  }
  if (parsed.data.op === "undo") {
    const { ruleId, field } = parsed.data;
    if (!ruleId || !field) return NextResponse.json({ error: "ruleId and field required." }, { status: 400 });
    return NextResponse.json({ removed: await undoDerivation(ruleId, field) });
  }
  return NextResponse.json(await applyDerivation());
}
