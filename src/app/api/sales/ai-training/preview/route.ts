import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { isAgentStage } from "@/lib/sales-ai/stages";
import { cleanList, detectSkip } from "@/lib/sales-ai/skip";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LIMIT = 15;
const schema = z.object({ skipPhrases: z.array(z.string()).max(80), skipTags: z.array(z.string()).max(40) });

type OppRow = { id: string; title: string; contact_name: string | null; tags: string[] | null; notes: string | null; stage: { name: string; is_won: boolean } | null };

// POST: what the skip rules, as typed and not yet saved, would do to the newest open opportunities.
// Reads titles, tags, notes and logged activity only. Odoo messages are checked when a draft is made.
export async function POST(req: Request): Promise<Response> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const rules = { skipPhrases: cleanList(parsed.data.skipPhrases, 40), skipTags: cleanList(parsed.data.skipTags, 20, 40) };

  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("sales_opportunities")
    .select("id, title, contact_name, tags, notes, stage:sales_stages(name, is_won)")
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(LIMIT);
  const opps = (data ?? []) as unknown as OppRow[];
  const ids = opps.map((o) => o.id);
  const byOpp = new Map<string, string[]>();
  if (ids.length) {
    const { data: log } = await db.from("sales_activity_log").select("opportunity_id, summary").in("opportunity_id", ids).is("deleted_at", null).limit(800);
    for (const l of (log ?? []) as Array<{ opportunity_id: string; summary: string }>) {
      const list = byOpp.get(l.opportunity_id) ?? [];
      list.push(l.summary);
      byOpp.set(l.opportunity_id, list);
    }
  }
  const rows = opps.map((o) => {
    const stageName = o.stage?.name ?? "No stage";
    if (!o.stage || !isAgentStage({ name: o.stage.name, is_won: o.stage.is_won })) {
      return { id: o.id, title: o.title, contactName: o.contact_name, stage: stageName, result: "off" as const, matched: [] as string[] };
    }
    const hit = detectSkip({ title: o.title, tags: o.tags ?? [], texts: [o.notes ?? "", ...(byOpp.get(o.id) ?? [])] }, rules);
    return { id: o.id, title: o.title, contactName: o.contact_name, stage: stageName, result: hit ? ("skipped" as const) : ("drafts" as const), matched: hit?.matched ?? [] };
  });
  return NextResponse.json({ rows, limit: LIMIT });
}
