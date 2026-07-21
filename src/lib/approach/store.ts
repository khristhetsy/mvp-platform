// Prospect Pipeline — Step 4: approach worker + audience store. Writes
// lead_prescore / prescore_dims / segment / approach onto classified rows.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { founderApproach, investorApproach, segmentFor, type HotFounderContext, type Segment } from "./models";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  company_domain: string | null;
  phone: string | null;
  side: "founder" | "investor" | null;
  email_status: string | null;
  signals: Record<string, unknown> | null;
  raw: Record<string, unknown> | null;
};

function websiteOf(raw: Record<string, unknown> | null): string | null {
  const w = raw?.["website"];
  return typeof w === "string" && w.length > 0 ? w : null;
}

/** Current hot-founder cohort — used to ground investor approach copy (real data). */
export async function getHotFounderContext(): Promise<HotFounderContext> {
  const db = serviceRoleClientUntyped();
  const { data, count } = await db
    .from("crm_contacts")
    .select("signals", { count: "exact" })
    .eq("side", "founder")
    .eq("segment", "hot")
    .limit(200);
  const sectors = new Set<string>();
  for (const r of (data ?? []) as Array<{ signals: Record<string, unknown> | null }>) {
    const s = r.signals?.["sector"];
    if (typeof s === "string" && s.trim()) sectors.add(s.trim());
  }
  return { count: count ?? 0, sectors: Array.from(sectors) };
}

export interface ApproachBatchResult {
  processed: number;
  founders: number;
  investors: number;
  hot: number;
  warm: number;
  cold: number;
  remaining: number;
}

const ROW_COLS = "id, name, email, company, company_domain, phone, side, email_status, signals, raw";

/** Compute + write approach for up to `limit` classified rows that lack one. */
export async function approachBatch(limit = 100): Promise<ApproachBatchResult> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("crm_contacts")
    .select(ROW_COLS)
    .not("side", "is", null)
    .is("approach", null)
    .limit(limit);
  return scoreRows(db, (data ?? []) as Row[]);
}

/** (Re)score a specific set of classified contacts — used by the list-scoped Step 3. */
export async function approachByIds(ids: string[]): Promise<ApproachBatchResult> {
  const db = serviceRoleClientUntyped();
  const capped = ids.slice(0, 1000);
  if (capped.length === 0) return { processed: 0, founders: 0, investors: 0, hot: 0, warm: 0, cold: 0, remaining: 0 };
  const { data } = await db.from("crm_contacts").select(ROW_COLS).in("id", capped).not("side", "is", null);
  return scoreRows(db, (data ?? []) as Row[]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scoreRows(db: any, rows: Row[]): Promise<ApproachBatchResult> {
  const hotCtx = await getHotFounderContext();
  const tally = { founders: 0, investors: 0, hot: 0, warm: 0, cold: 0 };

  for (const r of rows) {
    let segment: Segment;
    const patch: Record<string, unknown> = {};

    if (r.side === "founder") {
      const { approach, prescore } = founderApproach({
        name: r.name, email: r.email, company: r.company, company_domain: r.company_domain,
        website: websiteOf(r.raw), email_status: r.email_status, phone: r.phone, signals: r.signals,
      });
      const raising = r.signals?.["raising"] === true || r.signals?.["raising"] === "true";
      // Was an inline copy of this rule that had drifted from segmentFor.
      segment = segmentFor(prescore.score, raising);
      patch.lead_prescore = prescore.score;
      patch.prescore_dims = prescore.dims;
      patch.approach = approach;
      patch.segment = segment;
      tally.founders++;
    } else {
      const { approach, segment: seg } = investorApproach(
        { name: r.name, email: r.email, company: r.company, phone: r.phone, signals: r.signals },
        hotCtx,
      );
      segment = seg;
      patch.approach = approach;
      patch.segment = segment;
      tally.investors++;
    }

    tally[segment]++;
    // Surface write failures instead of silently dropping the score.
    const { error: upErr } = await db.from("crm_contacts").update(patch).eq("id", r.id);
    if (upErr) throw new Error(`Failed to persist score for ${r.id}: ${upErr.message}`);
  }

  const { count: remaining } = await db
    .from("crm_contacts")
    .select("id", { count: "exact", head: true })
    .not("side", "is", null)
    .is("approach", null);

  return { processed: rows.length, ...tally, remaining: remaining ?? 0 };
}

export interface AudienceStats {
  classified: number;
  approached: number;
  pending: number;
  hot: number;
  warm: number;
  cold: number;
}

export async function getAudienceStats(): Promise<AudienceStats> {
  const db = serviceRoleClientUntyped();
  const [{ count: classified }, { count: approached }, { count: pending }, { count: hot }, { count: warm }, { count: cold }] = await Promise.all([
    db.from("crm_contacts").select("id", { count: "exact", head: true }).not("side", "is", null),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).not("approach", "is", null),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).not("side", "is", null).is("approach", null),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("segment", "hot"),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("segment", "warm"),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("segment", "cold"),
  ]);
  return {
    classified: classified ?? 0,
    approached: approached ?? 0,
    pending: pending ?? 0,
    hot: hot ?? 0,
    warm: warm ?? 0,
    cold: cold ?? 0,
  };
}

export interface HotRow {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  side: string | null;
  lead_prescore: number | null;
  hook: string | null;
}

export async function getHotQueue(limit = 50): Promise<HotRow[]> {
  const db = serviceRoleClientUntyped();
  const { data } = await db
    .from("crm_contacts")
    .select("id, name, email, company, side, lead_prescore, approach")
    .eq("segment", "hot")
    .eq("converted", false)
    .eq("suppressed", false)
    .order("lead_prescore", { ascending: false, nullsFirst: false })
    .limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    name: (r.name as string) ?? null,
    email: (r.email as string) ?? null,
    company: (r.company as string) ?? null,
    side: (r.side as string) ?? null,
    lead_prescore: (r.lead_prescore as number) ?? null,
    hook: ((r.approach as { hook?: string } | null)?.hook) ?? null,
  }));
}
