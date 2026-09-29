/**
 * Investor enrichment. Staff-only.
 *   GET  ?status=pending|approved|rejected → { proposals }
 *   POST { op: "run", limit? }        → run an AI batch → { scanned, proposed, skipped }
 *   POST { op: "bulk", minConfidence } → approve all pending ≥ minConfidence → { approved }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listProposals, runEnrichment, approveHighConfidence } from "@/lib/fit/enrich-investors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const s = new URL(req.url).searchParams.get("status");
  const status = s === "approved" || s === "rejected" ? s : "pending";
  return NextResponse.json({ proposals: await listProposals(status) });
}

const schema = z.union([
  z.object({ op: z.literal("run"), limit: z.number().int().min(1).max(200).optional() }),
  z.object({ op: z.literal("bulk"), minConfidence: z.number().min(0).max(100) }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (parsed.data.op === "run") return NextResponse.json(await runEnrichment(parsed.data.limit ?? 40));
  return NextResponse.json({ approved: await approveHighConfidence(parsed.data.minConfidence, profile.id) });
}
