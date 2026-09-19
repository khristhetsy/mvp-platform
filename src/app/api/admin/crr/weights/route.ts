/**
 * CRR weight sets — admin only.
 *   GET                                   → { active, sets, scoreCounts, shape }
 *   POST { action: "preview", set }       → { impact, errors }
 *   POST { action: "save", set, version, reason, rescore } → { set, impact, rescored }
 *   POST { action: "revert", id, reason, rescore }         → { set, impact, rescored }
 * Saving never edits a version in place: it appends a new one and makes it active.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { CRR_DIMENSIONS, FACTOR_TO_DIMENSION } from "@/lib/crr/profiles";
import {
  CODE_DEFAULT_SET, DIMENSION_LABEL, FACTOR_KEYS, FACTOR_LABEL, PROFILE_KEYS, PROFILE_LABEL,
  diffSets, nextVersionName, summarizeDiff, validateSet, type WeightSet,
} from "@/lib/crr/weight-sets";
import { getSet, listSets, loadActiveSet, previewImpact, rescoreAllUnder, saveSet, scoreCountsByVersion } from "@/lib/crr/weight-sets-db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const dims = z.object({ narrative: z.number(), team: z.number(), financial: z.number(), traction: z.number(), capTable: z.number() });
const setSchema = z.object({
  profiles: z.record(z.string(), dims),
  factors: z.record(z.string(), z.number()),
  bands: z.object({ strong: z.number(), solid: z.number(), developing: z.number() }),
  floors: z.record(z.string(), z.object({ minTraction: z.number(), cap: z.enum(["Strong", "Solid", "Developing", "Early"]) })),
});

/** The fixed shape the editor renders: which factors belong to which dimension. */
const SHAPE = {
  dimensions: CRR_DIMENSIONS.map((d) => ({ key: d, label: DIMENSION_LABEL[d] })),
  profiles: PROFILE_KEYS.map((p) => ({ key: p, label: PROFILE_LABEL[p] })),
  factors: FACTOR_KEYS.map((k) => ({ key: k, label: FACTOR_LABEL[k], dimension: FACTOR_TO_DIMENSION[k] })),
  codeDefaults: CODE_DEFAULT_SET,
};

export async function GET() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const db = createServiceRoleClient();
  try {
    const [active, sets, scoreCounts] = await Promise.all([loadActiveSet(db), listSets(db), scoreCountsByVersion(db)]);
    const withDiff = sets.map((s, i) => {
      const prev = sets[i + 1];
      const rows = prev ? diffSets(prev, s) : [];
      return { ...s, diff: rows, summary: prev ? summarizeDiff(rows) : "Seeded from the code defaults" };
    });
    return NextResponse.json({ active, sets: withDiff, scoreCounts, shape: SHAPE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load weights." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;
  const db = createServiceRoleClient();
  const body = await req.json().catch(() => ({}));

  try {
    const current = await loadActiveSet(db);

    if (body?.action === "preview") {
      const parsed = setSchema.safeParse(body.set);
      if (!parsed.success) return NextResponse.json({ error: "Invalid weights." }, { status: 400 });
      const candidate = { ...current, ...parsed.data } as WeightSet;
      const errors = validateSet(candidate);
      const impact = errors.length ? null : await previewImpact(db, candidate, current);
      return NextResponse.json({ errors, impact, diff: diffSets(current, candidate) });
    }

    if (body?.action === "save" || body?.action === "revert") {
      let candidate: WeightSet;
      if (body.action === "revert") {
        const source = typeof body.id === "string" ? await getSet(db, body.id) : null;
        if (!source) return NextResponse.json({ error: "That version no longer exists." }, { status: 404 });
        candidate = { ...current, profiles: source.profiles, factors: source.factors, bands: source.bands, floors: source.floors };
      } else {
        const parsed = setSchema.safeParse(body.set);
        if (!parsed.success) return NextResponse.json({ error: "Invalid weights." }, { status: 400 });
        candidate = { ...current, ...parsed.data } as WeightSet;
      }

      const errors = validateSet(candidate);
      if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });

      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
      if (!reason) return NextResponse.json({ error: "Give a reason — it goes in the history." }, { status: 400 });

      const sets = await listSets(db);
      const taken = sets.map((s) => s.version);
      const requested = typeof body.version === "string" ? body.version.trim().slice(0, 60) : "";
      const version = requested && !taken.includes(requested) ? requested : nextVersionName(current.version, taken);

      const impact = await previewImpact(db, candidate, current);
      const saved = await saveSet(db, {
        version, profiles: candidate.profiles, factors: candidate.factors, bands: candidate.bands, floors: candidate.floors,
        reason, impact, createdBy: auth.profile.id,
      });

      const rescored = body.rescore === true ? await rescoreAllUnder(db, saved, reason) : { updated: 0, failed: 0 };
      await writeAuditLog(db, {
        userId: auth.profile.id,
        action: body.action === "revert" ? "crr_weights.reverted" : "crr_weights.saved",
        entityType: "crr_weight_set",
        entityId: saved.id,
        metadata: { version, reason, rescored: rescored.updated, diff: summarizeDiff(diffSets(current, candidate)) },
      });
      return NextResponse.json({ set: saved, impact, rescored });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save weights." }, { status: 500 });
  }
}
