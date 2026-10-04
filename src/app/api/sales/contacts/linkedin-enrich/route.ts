/**
 * /api/sales/contacts/linkedin-enrich — website enrichment for LinkedIn-imported contacts.
 *
 * GET  ?group=investor|founder|other|all → { contacts, companies, pendingContacts, pendingCompanies, budget }
 * POST { group, limit? } → one batch (default 50 companies), stopping early at the time
 *      budget or when the Data enrichment AI budget is used up. The page calls it again
 *      for the next batch ("Run all"); companies not reached stay pending.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getAiBudgetStatus } from "@/lib/ai-budget/service";
import { runEnrichBatch } from "@/lib/contacts/linkedin-enrich";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const group = z.enum(["investor", "founder", "other", "all"]);

async function budget() {
  try {
    const row = (await getAiBudgetStatus()).find((r) => r.category === "enrichment");
    return row ? { monthlyUsd: Number(row.monthly_usd), spentUsd: Number(row.spent_usd) } : null;
  } catch { return null; }
}

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const g = group.safeParse(req.nextUrl.searchParams.get("group") ?? "investor");
  if (!g.success) return NextResponse.json({ error: "Unknown group." }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();
  const { data, error } = await db.rpc("linkedin_enrich_stats", { p_group: g.data });
  if (error) return NextResponse.json({ error: error.message.includes("linkedin_enrich_stats") ? "The LinkedIn import migration hasn't been run yet." : error.message }, { status: 500 });
  const s = (data ?? [])[0] ?? {};
  return NextResponse.json({
    contacts: Number(s.contacts ?? 0), companies: Number(s.companies ?? 0),
    pendingContacts: Number(s.pending_contacts ?? 0), pendingCompanies: Number(s.pending_companies ?? 0),
    budget: await budget(),
  });
}

const postSchema = z.object({ group, limit: z.number().int().min(1).max(100).optional() });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const p = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Choose a group." }, { status: 400 });
  try {
    // Stop starting new companies well before the 300 s limit; a company can take ~40 s.
    const batch = await runEnrichBatch(p.data.group, p.data.limit ?? 50, 230_000);
    if (batch.notConfigured) return NextResponse.json({ error: "Web search isn't configured (SERPER_API_KEY)." }, { status: 400 });
    return NextResponse.json({ ...batch, budget: await budget() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enrichment failed." }, { status: 500 });
  }
}
