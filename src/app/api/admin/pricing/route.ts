/**
 * Subscription pricing — admin only.
 *   GET                                        → { active, sets, counts, provider, surfaces, shape }
 *   POST { action: "save", plans, addCompanyCents, reason, existingPolicy, effectiveAt, version }
 *   POST { action: "revert", id, reason }
 *
 * Saving appends a version and makes it active; nothing is edited in place, so
 * the history stays a record of what each month was billed under.
 *
 * What LemonSqueezy charges is NOT written from here — their prices are
 * immutable and not writable through the API. We read the variant and warn.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import {
  CODE_DEFAULT_PRICING, PLAN_SHORT, PRICED_PLANS, diffPricing, nextPricingVersion,
  priceSurfaces, summarizePricingDiff, validatePricing,
  type PricedPlan, type PricedPlanKey,
} from "@/lib/subscriptions/pricing-catalog";
import { listPricingSets, loadPricing } from "@/lib/subscriptions/pricing-server";
import { getPricingSet, planCounts, providerPrices, savePricing } from "@/lib/subscriptions/pricing-admin";

export const dynamic = "force-dynamic";

const planSchema = z.object({
  cents: z.number(),
  label: z.string().nullable().optional(),
  sublabel: z.string().nullable().optional(),
  contactSales: z.boolean().optional(),
});
const draftSchema = z.object({
  plans: z.record(z.string(), planSchema),
  addCompanyCents: z.number(),
});

const SHAPE = {
  plans: PRICED_PLANS.map((key) => ({ key, label: PLAN_SHORT[key] ?? key })),
  codeDefaults: CODE_DEFAULT_PRICING,
};

export async function GET() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const db = createServiceRoleClient();
  try {
    const active = await loadPricing();
    const [sets, counts, provider] = await Promise.all([listPricingSets(), planCounts(db), providerPrices(active)]);
    const withDiff = sets.map((s, i) => {
      const prev = sets[i + 1];
      const rows = prev ? diffPricing(prev, s) : [];
      return { ...s, diff: rows, summary: prev ? summarizePricingDiff(rows) : "Seeded from the code constants" };
    });
    return NextResponse.json({ active, sets: withDiff, counts, provider, surfaces: priceSurfaces(active), shape: SHAPE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load pricing." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiProfile(["admin"]);
  if ("error" in auth) return auth.error;
  const db = createServiceRoleClient();
  const body = await req.json().catch(() => ({}));

  try {
    const current = await loadPricing();

    let plans: Record<PricedPlanKey, PricedPlan>;
    let addCompanyCents: number;

    if (body?.action === "revert") {
      const source = typeof body.id === "string" ? await getPricingSet(db, body.id) : null;
      if (!source) return NextResponse.json({ error: "That version no longer exists." }, { status: 404 });
      plans = source.plans;
      addCompanyCents = source.addCompanyCents;
    } else if (body?.action === "save" || body?.action === "preview") {
      const parsed = draftSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid prices." }, { status: 400 });
      plans = { ...current.plans, ...(parsed.data.plans as Record<PricedPlanKey, PricedPlan>) };
      addCompanyCents = parsed.data.addCompanyCents;
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const errors = validatePricing({ plans, addCompanyCents });
    const candidate = { ...current, plans, addCompanyCents };
    const diff = diffPricing(current, candidate);

    if (body?.action === "preview") {
      return NextResponse.json({ errors, diff, summary: summarizePricingDiff(diff), surfaces: priceSurfaces(candidate) });
    }
    if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });

    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!reason) return NextResponse.json({ error: "Give a reason — it goes in the history." }, { status: 400 });

    const taken = (await listPricingSets()).map((s) => s.version);
    const requested = typeof body.version === "string" ? body.version.trim().slice(0, 60) : "";
    const version = requested && !taken.includes(requested) ? requested : nextPricingVersion(current.version, taken);

    const saved = await savePricing(db, {
      version,
      plans,
      addCompanyCents,
      reason,
      existingPolicy: body.existingPolicy === "migrate" ? "migrate" : "grandfather",
      effectiveAt: typeof body.effectiveAt === "string" && body.effectiveAt ? body.effectiveAt : null,
      createdBy: auth.profile.id,
    });

    await writeAuditLog(db, {
      userId: auth.profile.id,
      action: body.action === "revert" ? "pricing.reverted" : "pricing.saved",
      entityType: "pricing_set",
      entityId: saved.id ?? version,
      metadata: { version, reason, existingPolicy: saved.existingPolicy, diff: summarizePricingDiff(diff) },
    });

    return NextResponse.json({ set: saved, diff, summary: summarizePricingDiff(diff) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save pricing." }, { status: 500 });
  }
}
