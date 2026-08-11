import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { getActiveOrgId } from "@/lib/organizations/active-org";
import { createValuation, type SaveValuationInput } from "@/lib/valuation/store";
import type { MethodResult } from "@/lib/valuation/methods";

export const dynamic = "force-dynamic";

// POST /api/valuations — save the current valuation + its method rows so it can
// be reopened exactly. Never writes back to the company profile (spec §6.4).
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  const plan = await getUserPlan(profile.id);
  if (plan !== "founder_basic" && plan !== "founder_professional") {
    return NextResponse.json({ error: "The Valuation Studio is available on Basic and Professional plans." }, { status: 403 });
  }

  const orgId = await getActiveOrgId(supabase, profile.id);
  if (!orgId) return NextResponse.json({ error: "No active account." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Partial<SaveValuationInput> | null;
  if (!body || !body.companyName || !body.stageProfile || !Array.isArray(body.methods)) {
    return NextResponse.json({ error: "Invalid valuation payload." }, { status: 400 });
  }

  const id = await createValuation(supabase, orgId, profile.id, {
    companyName: String(body.companyName),
    sector: String(body.sector ?? ""),
    stageProfile: body.stageProfile,
    source: body.source === "profile" ? "profile" : "manual",
    isScenario: body.isScenario !== false,
    convergedLow: Number(body.convergedLow ?? 0),
    convergedHigh: Number(body.convergedHigh ?? 0),
    inputs: (body.inputs as Record<string, unknown>) ?? {},
    inputProvenance: (body.inputProvenance as Record<string, string>) ?? {},
    methods: body.methods as MethodResult[],
  });

  if (!id) return NextResponse.json({ error: "Could not save the valuation." }, { status: 500 });
  return NextResponse.json({ id }, { status: 201 });
}
