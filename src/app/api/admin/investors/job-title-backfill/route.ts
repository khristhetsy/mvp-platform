/**
 * Deterministic company/type backfill from the Job Position line. Staff-only.
 *   POST { op: "preview" }              → { changes: BackfillChange[], companies, types }
 *   POST { op: "apply" }                → { scanned, companies, types }
 * No AI, no cost — see src/lib/investors/job-title.ts for the parse rules and the
 * conditions under which a company name is (and is not) overwritten.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { planBackfill, applyBackfill } from "@/lib/investors/job-title";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ op: z.enum(["preview", "apply"]) });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (parsed.data.op === "preview") {
    const changes = await planBackfill();
    return NextResponse.json({
      // Cap the payload — the counts describe the whole plan, the list is a sample.
      changes: changes.slice(0, 300),
      total: changes.length,
      companies: changes.filter((c) => c.newCompany).length,
      types: changes.filter((c) => c.newType).length,
    });
  }
  return NextResponse.json(await applyBackfill());
}
