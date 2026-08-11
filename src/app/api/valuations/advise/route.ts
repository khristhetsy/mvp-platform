import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { getActiveOrgId } from "@/lib/organizations/active-org";
import { getOrganization } from "@/lib/organizations/organizations";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import { checkRateLimit } from "@/lib/api/rate-limit";
import {
  ADVISOR_SYSTEM,
  buildAdvicePrompt,
  validateAdvice,
  SAMPLE_ADVICE,
  type AdvisePayload,
  type Advice,
} from "@/lib/valuation/advisor";

export const dynamic = "force-dynamic";

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

// POST /api/valuations/advise — the founder-side improvement advisor. Server-side
// only; the API key never reaches the client. Internal/demo accounts get sample
// mode with no live call. Every generation is persisted for the audit record.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  // Plan gate — Basic + Professional (not trial).
  const plan = await getUserPlan(profile.id);
  if (plan !== "founder_basic" && plan !== "founder_professional") {
    return NextResponse.json(
      { error: "The Valuation Studio is available on Basic and Professional plans.", code: "plan_required" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | (AdvisePayload & { valuationId?: string; sample?: boolean })
    | null;
  if (!body || !Array.isArray(body.methods) || !Array.isArray(body.convergedRange)) {
    return NextResponse.json({ error: "Invalid valuation payload." }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  async function persist(advice: Advice, isSample: boolean, model: string) {
    if (!body?.valuationId) return; // unsaved scratch run — nothing to attach to
    // Insert via the RLS-bound client so a founder can only write advice onto a
    // valuation in their own organization.
    await loose(supabase).from("valuation_advice").insert({
      valuation_id: body.valuationId,
      read: advice.read,
      spread: advice.spread,
      caution: advice.caution,
      levers: advice.levers,
      model,
      is_sample: isSample,
    });
  }

  // Internal/demo accounts default to sample mode — no live traffic (spec §7.1).
  const orgId = await getActiveOrgId(supabase, profile.id);
  const org = orgId ? await getOrganization(admin, orgId) : null;
  const isDemoAccount =
    org?.purpose === "demo" || org?.purpose === "internal" || org?.created_via === "admin_direct";

  if (body.sample || isDemoAccount || !isClaudeConfigured()) {
    await persist(SAMPLE_ADVICE, true, "sample");
    return NextResponse.json({ advice: SAMPLE_ADVICE, isSample: true });
  }

  // Rate limit: one generation per valuation (or user) per 60 seconds.
  const rl = checkRateLimit({ key: `val-advise:${body.valuationId ?? profile.id}`, limit: 1, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "One improvement plan per minute. Change an input and try again shortly.", code: "rate_limited" },
      { status: 429 },
    );
  }

  const payload: AdvisePayload = {
    stage: body.stage,
    sector: body.sector,
    convergedRange: body.convergedRange,
    methods: body.methods,
    drivers: body.drivers ?? {},
    provenance: body.provenance,
  };
  const prompt = buildAdvicePrompt(payload);

  async function generate() {
    const text = await claudeComplete([{ role: "user", content: prompt }], {
      model: CLAUDE_SONNET,
      maxTokens: 1400,
      system: ADVISOR_SYSTEM,
    });
    return validateAdvice(text);
  }

  try {
    let result = await generate();
    // A banned term earns exactly one regeneration, then we fall back (§6, §2).
    if (!result.ok && result.reason === "banned-term") result = await generate();
    if (!result.ok) {
      return NextResponse.json(
        { error: "The advisor couldn't produce a usable plan. Adjust an input and run it again." },
        { status: 502 },
      );
    }
    await persist(result.advice, false, CLAUDE_SONNET);
    return NextResponse.json({ advice: result.advice, isSample: false });
  } catch {
    return NextResponse.json(
      { error: "The advisor is unavailable right now. Try again in a moment." },
      { status: 502 },
    );
  }
}
