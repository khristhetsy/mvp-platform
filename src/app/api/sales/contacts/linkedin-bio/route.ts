/**
 * /api/sales/contacts/linkedin-bio — bio drafts for LinkedIn-imported contacts.
 *
 * GET  ?group=investor|founder|other|all → { total, written, none, pending }
 * POST { group, limit? } → one batch (default 25 people). Each bio is a draft tagged
 *      "inferred:ai" that staff confirm in the contact window. Stops early at the time
 *      budget or when the Data enrichment budget is used up.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { bioStats, runBioBatch } from "@/lib/contacts/linkedin-bio";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const group = z.enum(["investor", "founder", "other", "all"]);

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const g = group.safeParse(req.nextUrl.searchParams.get("group") ?? "investor");
  if (!g.success) return NextResponse.json({ error: "Unknown group." }, { status: 400 });
  try { return NextResponse.json(await bioStats(g.data)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load." }, { status: 500 }); }
}

const postSchema = z.object({ group, limit: z.number().int().min(1).max(60).optional() });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Choose a group." }, { status: 400 });
  try {
    const batch = await runBioBatch(p.data.group, p.data.limit ?? 25, 230_000);
    if (batch.notConfigured) return NextResponse.json({ error: "Web search or AI isn't configured." }, { status: 400 });
    return NextResponse.json({ ...batch, stats: await bioStats(p.data.group) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bio drafts failed." }, { status: 500 });
  }
}
