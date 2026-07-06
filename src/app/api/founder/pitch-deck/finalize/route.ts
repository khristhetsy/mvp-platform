import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { upsertPitchDeck } from "@/lib/pitch-deck/store";

export const dynamic = "force-dynamic";

// POST /api/founder/pitch-deck/finalize — mark the deck finalized.
export async function POST(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const deck = await upsertPitchDeck(g.supabase, g.company.id, g.profile.id, { status: "finalized" });
    return NextResponse.json({ deck });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to finalize deck." }, { status: 500 });
  }
}
