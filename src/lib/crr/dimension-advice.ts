/**
 * Improvement suggestions for one CRR dimension of one company.
 *
 * Generated the first time a dimension card is opened and cached on the score
 * row (company_readiness_scores.dimension_advice). The table is append-only, so
 * the next scoring run starts with an empty cache and advice can never outlive
 * the score it describes.
 *
 * Two sources, in order:
 *   1. Claude, reading that dimension's factor evidence, sub-scores and flags.
 *   2. The flags themselves, assembled and ranked — used when ANTHROPIC_API_KEY
 *      is absent or the call fails, so the panel is never empty. Same graceful
 *      degradation as the rest of the AI features.
 *
 * The POINT GAINS are never Claude's. They come from rankedGaps() in
 * dimension-detail.ts and are recomputed on every read, so they always reflect
 * the weighting that is active right now.
 */
import { CLAUDE_HAIKU, claudeComplete, isClaudeConfigured } from "@/lib/claude";
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";
import { DIMENSION_LABEL, FACTOR_LABEL, type WeightSet } from "@/lib/crr/weight-sets";
import type { Dimension, ProfileKey } from "@/lib/crr/profiles";
import { PROFILE_LABEL } from "@/lib/crr/weight-sets";
import { factorsIn, rankedGaps, type Gap } from "@/lib/crr/dimension-detail";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createServiceRoleClient>;

export type AdviceItem = {
  title: string;
  detail: string;
  /** Which factor the action moves — lets the UI attach the computed gain. */
  factor: FactorKey | null;
};
export type DimensionAdvice = {
  source: "ai" | "flags";
  generatedAt: string;
  items: AdviceItem[];
};

/** Advice plus the freshly-computed gain for each item. */
export type AdviceWithGains = DimensionAdvice & {
  items: Array<AdviceItem & { gain: number }>;
};

// ── Fallback: assemble from the flags the scorer already wrote ────────────────

/**
 * Rank the red/amber flags inside a dimension by what their factor is costing.
 * Honest and specific about which document is missing; the wording is the
 * scorer's generic text rather than anything about this company's own materials.
 */
export function adviceFromFlags(
  dimension: Dimension,
  factorScores: Partial<Record<FactorKey, FactorScore>>,
  gaps: Gap[],
): DimensionAdvice {
  const order = new Map(gaps.map((g, i) => [g.key, i]));
  const items: AdviceItem[] = [];

  for (const key of factorsIn(dimension).sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))) {
    const score = factorScores[key];
    if (!score) continue;
    for (const flag of score.flags ?? []) {
      if (flag.severity === "green") continue;
      items.push({ title: flag.label, detail: flag.detail, factor: key });
    }
  }

  // Nothing flagged but still short of full marks — say the plain thing.
  if (!items.length) {
    for (const g of gaps.filter((x) => x.lost > 0).slice(0, 3)) {
      items.push({
        title: `Strengthen ${g.label}`,
        detail: `Scored ${g.pts} of ${g.max}. No specific issue was flagged, so the gap is most likely missing documentation rather than a weak answer.`,
        factor: g.key,
      });
    }
  }

  return { source: "flags", generatedAt: new Date().toISOString(), items: items.slice(0, 3) };
}

// ── Primary: one Claude call for this dimension ───────────────────────────────

function promptFor(
  company: string,
  dimension: Dimension,
  profile: ProfileKey,
  factorScores: Partial<Record<FactorKey, FactorScore>>,
  gaps: Gap[],
): string {
  const lines: string[] = [];
  for (const g of gaps) {
    const s = factorScores[g.key];
    lines.push(`\n## ${FACTOR_LABEL[g.key]} — ${g.pts} of ${g.max} pts (worth ${g.lost} pts of the company score if fixed)`);
    if (s?.aiSummary) lines.push(`Scorer's note: ${s.aiSummary}`);
    for (const sub of s?.subScores ?? []) lines.push(`- sub-score: ${sub.label} — ${sub.pts}/${sub.max}`);
    for (const e of s?.evidence ?? []) lines.push(`- evidence (${e.icon}): ${e.text} [${e.src}]`);
    for (const f of s?.flags ?? []) lines.push(`- flag (${f.severity}): ${f.label} — ${f.detail}`);
  }

  return `A company called "${company}" has been scored on capital readiness. You are looking at one area of that score: ${DIMENSION_LABEL[dimension]}. The company is raising at the ${PROFILE_LABEL[profile]} stage.

Here is what the scoring engine found in their data room for the factors in this area:
${lines.join("\n")}

Write at most THREE actions the company should take to improve this area, most valuable first.

Rules:
- Be specific to THIS company's evidence. Refer to what the scorer actually found or did not find. Never give generic fundraising advice.
- Each action must be something the founder can do — produce a document, add a figure, sign an agreement. Not "improve traction".
- Never state a point value, percentage, score or band. Those are computed elsewhere and yours would be wrong.
- Never promise or imply a funding outcome.
- If the evidence does not support three distinct actions, give fewer.

Return ONLY a JSON array, no prose around it:
[{"title": "one short imperative sentence", "detail": "1-2 sentences saying what is missing and what to provide", "factor": "the factor key this moves"}]

Valid factor keys: ${factorsIn(dimension).join(", ")}`;
}

function parseItems(text: string, allowed: FactorKey[]): AdviceItem[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const ok = new Set<string>(allowed);
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      title: String(r.title ?? "").trim().slice(0, 140),
      detail: String(r.detail ?? "").trim().slice(0, 600),
      factor: ok.has(String(r.factor)) ? (String(r.factor) as FactorKey) : null,
    }))
    .filter((r) => r.title && r.detail)
    .slice(0, 3);
}

/** Generate advice for one dimension. Falls back to the flags rather than failing. */
export async function generateAdvice(args: {
  company: string;
  dimension: Dimension;
  profile: ProfileKey;
  factorScores: Partial<Record<FactorKey, FactorScore>>;
  gaps: Gap[];
}): Promise<DimensionAdvice> {
  const { company, dimension, profile, factorScores, gaps } = args;
  const fallback = () => adviceFromFlags(dimension, factorScores, gaps);
  if (!isClaudeConfigured()) return fallback();

  try {
    const text = await claudeComplete(
      [{ role: "user", content: promptFor(company, dimension, profile, factorScores, gaps) }],
      {
        model: CLAUDE_HAIKU,
        maxTokens: 900,
        locale: "en",
        system: "You advise a capital-readiness analyst. You are precise, you never invent evidence, and you never predict or promise a funding outcome.",
      },
    );
    const items = parseItems(text, factorsIn(dimension));
    if (!items.length) return fallback();
    return { source: "ai", generatedAt: new Date().toISOString(), items };
  } catch {
    return fallback();
  }
}

// ── Cache on the score row ────────────────────────────────────────────────────

export async function readCachedAdvice(db: Db, scoreId: string, dimension: Dimension): Promise<DimensionAdvice | null> {
  const { data } = await db.from("company_readiness_scores").select("dimension_advice").eq("id", scoreId).maybeSingle();
  const bag = (data?.dimension_advice ?? {}) as Record<string, DimensionAdvice | undefined>;
  const hit = bag[dimension];
  return hit && Array.isArray(hit.items) ? hit : null;
}

/** Merge one dimension into the bag without clobbering the others. */
export async function writeCachedAdvice(db: Db, scoreId: string, dimension: Dimension, advice: DimensionAdvice): Promise<void> {
  const { data } = await db.from("company_readiness_scores").select("dimension_advice").eq("id", scoreId).maybeSingle();
  const bag = { ...((data?.dimension_advice ?? {}) as Record<string, unknown>), [dimension]: advice };
  await db.from("company_readiness_scores").update({ dimension_advice: bag } as never).eq("id", scoreId);
}

/** Attach the freshly-computed gain to each item — never stored, never Claude's. */
export function withGains(advice: DimensionAdvice, gaps: Gap[]): AdviceWithGains {
  const byFactor = new Map(gaps.map((g) => [g.key, g.lost]));
  return {
    ...advice,
    items: advice.items.map((i) => ({ ...i, gain: (i.factor && byFactor.get(i.factor)) || 0 })),
  };
}

/** Read-through cache: cached advice, or generate it and store it. */
export async function adviceFor(args: {
  db: Db;
  scoreId: string;
  company: string;
  dimension: Dimension;
  profile: ProfileKey;
  factorScores: Partial<Record<FactorKey, FactorScore>>;
  set: WeightSet;
  storedFactors: Parameters<typeof rankedGaps>[1];
  force?: boolean;
}): Promise<AdviceWithGains> {
  const { db, scoreId, company, dimension, profile, factorScores, set, storedFactors, force } = args;
  const gaps = rankedGaps(dimension, storedFactors, set, profile);

  if (!force) {
    const cached = await readCachedAdvice(db, scoreId, dimension).catch(() => null);
    if (cached) return withGains(cached, gaps);
  }

  const fresh = await generateAdvice({ company, dimension, profile, factorScores, gaps });
  await writeCachedAdvice(db, scoreId, dimension, fresh).catch(() => {});
  return withGains(fresh, gaps);
}
