import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { randomBytes } from "crypto";
import { gateBusinessPlanApi } from "@/lib/business-plan/gate";
import { getPitchDeck, upsertPitchDeck } from "@/lib/pitch-deck/store";

export const dynamic = "force-dynamic";

// POST /api/founder/pitch-deck/share — create (or reuse) a read-only public link.
export async function POST(): Promise<Response> {
  const g = await gateBusinessPlanApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const existing = await getPitchDeck(g.supabase, g.company.id);
    let token = existing?.shareToken ?? null;
    if (!token) {
      token = randomBytes(16).toString("hex");
      await upsertPitchDeck(g.supabase, g.company.id, g.profile.id, { shareToken: token });
    }
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.json({ url: `${base}/deck/${token}`, token });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create share link." }, { status: 500 });
  }
}
