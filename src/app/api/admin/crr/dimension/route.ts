/**
 * One CRR dimension for one company — the panel behind a dimension card.
 *
 *   POST { companyId, dimension }                     → detail + cached/generated advice
 *   POST { companyId, dimension, action: "regenerate" } → same, ignoring the cache
 *   POST { companyId, dimension, action: "send" }       → notify the founder with the advice
 *
 * The arithmetic is recomputed on every call from the stored factor scores and
 * the ACTIVE weight set, so the panel can never show gains from a weighting that
 * has since been changed. Only the suggestion prose is cached.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { writeAuditLog } from "@/lib/data/audit";
import { CRR_DIMENSIONS, type Dimension, type ProfileKey } from "@/lib/crr/profiles";
import { normalizeFundingStage } from "@/lib/crr/select-score";
import { stageToProfile } from "@/lib/crr/profiles";
import { DIMENSION_LABEL, PROFILE_LABEL, type StoredFactor } from "@/lib/crr/weight-sets";
import { loadActiveSet } from "@/lib/crr/weight-sets-db";
import { dimensionDetail, rankedGaps } from "@/lib/crr/dimension-detail";
import { adviceFor } from "@/lib/crr/dimension-advice";
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const isDimension = (v: unknown): v is Dimension => (CRR_DIMENSIONS as readonly string[]).includes(String(v));

export async function POST(req: NextRequest) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const companyId = typeof body?.companyId === "string" ? body.companyId : "";
  const dimension = body?.dimension;
  if (!companyId || !isDimension(dimension)) {
    return NextResponse.json({ error: "A company and a dimension are required." }, { status: 400 });
  }

  const db = createServiceRoleClient();

  try {
    // Newest score row wins — the table is append-only.
    const { data: score } = await db
      .from("company_readiness_scores")
      .select("id, factor_scores, total_score, effective_score, override_score, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!score) return NextResponse.json({ error: "This company has not been scored yet." }, { status: 404 });

    // funding_stage is on the table (migration 20260803002) but not yet in the
    // generated types — same cast weight-sets-db.ts uses.
    const { data: companyRow } = await db
      .from("companies")
      .select("id, company_name, funding_stage, founder_id")
      .eq("id", companyId)
      .maybeSingle();
    const company = companyRow as unknown as
      | { id: string; company_name: string | null; funding_stage: string | null; founder_id: string | null }
      | null;

    const profile: ProfileKey = stageToProfile(normalizeFundingStage(company?.funding_stage));
    const set = await loadActiveSet(db);

    const factorScores = (score.factor_scores ?? {}) as Partial<Record<FactorKey, FactorScore>>;
    // FactorScore carries pts/max, which is all the arithmetic needs.
    const storedFactors = factorScores as Partial<Record<FactorKey, StoredFactor>>;

    const detail = dimensionDetail(dimension, storedFactors, set, profile);
    const gaps = rankedGaps(dimension, storedFactors, set, profile);
    const companyName = company?.company_name ?? "Company";

    const advice = await adviceFor({
      db,
      scoreId: score.id as string,
      company: companyName,
      dimension,
      profile,
      factorScores,
      set,
      storedFactors,
      force: body?.action === "regenerate",
    });

    // Evidence for the "what the AI read" list, flattened across this dimension's factors.
    const evidence = detail.factors.flatMap((f) =>
      (factorScores[f.key]?.evidence ?? []).map((e) => ({ ...e, factor: f.key, factorLabel: f.label })),
    );

    if (body?.action === "send") {
      const founderId = company?.founder_id ?? null;
      if (!founderId) return NextResponse.json({ error: "This company has no founder account to notify." }, { status: 400 });
      if (!advice.items.length) return NextResponse.json({ error: "There is nothing to send yet." }, { status: 400 });

      // Deliberately carries the ACTIONS only — never the score, band or weighting.
      // CRR scores are admin- and investor-visible; founders cannot see their own.
      await createNotification({
        recipientUserId: founderId,
        actorUserId: auth.profile.id,
        type: "readiness_suggestions_shared",
        title: `Suggestions to strengthen your ${DIMENSION_LABEL[dimension].toLowerCase()} materials`,
        message: advice.items.map((i, n) => `${n + 1}. ${i.title} — ${i.detail}`).join("\n\n"),
        entityType: "company",
        entityId: companyId,
        deepLink: "/founder/documents",
      });
      await writeAuditLog(db, {
        userId: auth.profile.id,
        action: "crr.advice_sent",
        entityType: "company",
        entityId: companyId,
        metadata: { dimension, items: advice.items.length, source: advice.source },
      });
      return NextResponse.json({ sent: true });
    }

    return NextResponse.json({
      company: companyName,
      companyId,
      profile,
      profileLabel: PROFILE_LABEL[profile],
      version: set.version,
      detail,
      gaps,
      advice,
      evidence,
      factorScores: Object.fromEntries(detail.factors.map((f) => [f.key, factorScores[f.key] ?? null])),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the dimension." }, { status: 500 });
  }
}
