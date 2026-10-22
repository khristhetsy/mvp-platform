/**
 * Founder CRR Proof loader. Server only.
 *
 * Reads the platform's own records and shapes them into ProofCompany rows. No
 * writes, and nothing estimated: a company with no meeting, intro or
 * conversation record gets `activity: null`.
 *
 * Sources:
 *  · scores        company_readiness_scores (append-only), re-scored under the
 *                  ACTIVE weighting so first and latest are like for like.
 *                  Rows written by a weight edit (change_kind = 'weights') are
 *                  skipped: they re-state an old measurement, they are not a
 *                  new one.
 *  · quote         founder_testimonials: approved = yes, pending = pending.
 *  · meetings      thread_meetings with status accepted or scheduled.
 *  · intros        intro_requests, any status.
 *  · conversations message_threads past the "requested" stage.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveSet } from "@/lib/crr/weight-sets-db";
import { stageToProfile, FACTOR_TO_DIMENSION } from "@/lib/crr/profiles";
import { normalizeFundingStage } from "@/lib/crr/select-score";
import {
  DIMENSION_LABEL, FACTOR_KEYS, FACTOR_LABEL, OUTREACH_GATE, PROFILE_LABEL,
  bandForProfileWith, rollupWith, totalWith, type StoredFactor, type WeightSet,
} from "@/lib/crr/weight-sets";
import type { FactorGap } from "@/lib/crr/improvement";
import type { ProfileKey } from "@/lib/crr/profiles";
import type { ProofActivity, ProofCompany, ProofPayload, ProofQuote, ProofScore } from "@/lib/crr/proof";

/* eslint-disable @typescript-eslint/no-explicit-any -- generated types don't cover several of these columns. */
type Db = SupabaseClient<any, any, any>;
type Row = Record<string, any>;

const PAGE = 1000;

/** Every row of a query, past the 1000 row default cap. */
async function all(build: () => any): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function scoreOf(row: Row, profile: ProfileKey, set: WeightSet): ProofScore {
  const stored = (row.factor_scores ?? {}) as Partial<Record<string, StoredFactor>>;
  const points = set.factors[profile] ?? set.factors.seriesA_institutional;
  const dims = rollupWith(stored as any, points);
  const override = typeof row.override_score === "number" ? row.override_score : null;
  const score = override ?? totalWith(stored as any, points);
  return { score, at: row.created_at as string, band: bandForProfileWith(score, profile, dims.traction, set), dims };
}

function gapsOf(row: Row, profile: ProfileKey, set: WeightSet): FactorGap[] {
  const stored = (row.factor_scores ?? {}) as Partial<Record<string, StoredFactor>>;
  const points = set.factors[profile] ?? set.factors.seriesA_institutional;
  return FACTOR_KEYS.map((key) => {
    const max = points[key] ?? 0;
    const f = stored[key];
    const ratio = f && f.max > 0 ? Math.min(1, Math.max(0, f.pts / f.max)) : 0;
    return { key, label: FACTOR_LABEL[key], pts: Math.round(ratio * max * 10) / 10, max, dimension: DIMENSION_LABEL[FACTOR_TO_DIMENSION[key]] };
  });
}

const countBy = (rows: Row[], key = "company_id") => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + 1);
  return m;
};

export async function loadProof(db: Db): Promise<ProofPayload> {
  const set = await loadActiveSet(db);

  const [companies, scores, quotes, meetings, intros, threads] = await Promise.all([
    all(() => db.from("companies").select("id, company_name, industry, funding_stage, founder_id").order("company_name", { ascending: true })),
    all(() => db.from("company_readiness_scores").select("company_id, factor_scores, override_score, change_kind, created_at").order("created_at", { ascending: true })),
    all(() => db.from("founder_testimonials").select("company_id, status").not("company_id", "is", null)),
    all(() => db.from("thread_meetings").select("company_id").in("status", ["accepted", "scheduled"])),
    all(() => db.from("intro_requests").select("company_id")),
    all(() => db.from("message_threads").select("company_id").neq("status", "requested")),
  ]);

  const founderIds = [...new Set(companies.map((c) => c.founder_id).filter(Boolean))] as string[];
  const founders = new Map<string, Row>();
  for (let i = 0; i < founderIds.length; i += 200) {
    const { data } = await db.from("profiles").select("id, full_name, email").in("id", founderIds.slice(i, i + 200));
    for (const p of (data ?? []) as Row[]) founders.set(p.id, p);
  }

  const byCompany = new Map<string, Row[]>();
  for (const r of scores) {
    if (r.change_kind === "weights") continue;
    const k = String(r.company_id);
    byCompany.set(k, [...(byCompany.get(k) ?? []), r]);
  }

  const quoteBy = new Map<string, ProofQuote>();
  for (const q of quotes) {
    const k = String(q.company_id);
    if (q.status === "approved") quoteBy.set(k, "yes");
    else if (q.status === "pending" && quoteBy.get(k) !== "yes") quoteBy.set(k, "pending");
  }

  const mtg = countBy(meetings), req = countBy(intros), conv = countBy(threads);

  const out: ProofCompany[] = [];
  for (const c of companies) {
    const rows = byCompany.get(String(c.id)) ?? [];
    const profile = stageToProfile(normalizeFundingStage(c.funding_stage as string | null));
    const scored = rows.map((r) => scoreOf(r, profile, set));
    const act: ProofActivity = { meetings: mtg.get(c.id) ?? 0, conversations: conv.get(c.id) ?? 0, intros: req.get(c.id) ?? 0 };
    const f = c.founder_id ? founders.get(c.founder_id) : undefined;
    out.push({
      companyId: c.id,
      companyName: (c.company_name as string) ?? "Unnamed company",
      founderName: (f?.full_name as string) ?? null,
      founderEmail: (f?.email as string) ?? null,
      industry: (c.industry as string) ?? null,
      profile,
      profileLabel: PROFILE_LABEL[profile],
      first: scored[0] ?? null,
      latest: scored[scored.length - 1] ?? null,
      history: scored.map((s) => ({ score: s.score, at: s.at })),
      quote: quoteBy.get(c.id) ?? "none",
      activity: act.meetings + act.conversations + act.intros > 0 ? act : null,
      gaps: rows.length ? gapsOf(rows[rows.length - 1], profile, set) : [],
    });
  }

  return { generatedAt: new Date().toISOString(), gate: OUTREACH_GATE, bands: set.bands, companies: out };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
