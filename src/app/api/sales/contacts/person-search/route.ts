/**
 * /api/sales/contacts/person-search — free "person, then company" search on firm websites.
 *
 * GET  ?group=investor|all → { pending, searched }
 * POST { group, limit? }   → one batch; results are proposals for the profile fill review.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { personStats, runPersonBatch } from "@/lib/contacts/profile-fill/person-batch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const group = req.nextUrl.searchParams.get("group") === "all" ? "all" : "investor";
  try { return NextResponse.json(await personStats(group)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load." }, { status: 500 }); }
}

const schema = z.object({ group: z.enum(["investor", "all"]), limit: z.number().int().min(1).max(60).optional() });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = schema.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Choose a group." }, { status: 400 });
  try {
    // Stop starting new contacts well before the 300 s limit; one can take ~30 s.
    return NextResponse.json(await runPersonBatch(p.data.group, p.data.limit ?? 30, 230_000));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed." }, { status: 500 });
  }
}
