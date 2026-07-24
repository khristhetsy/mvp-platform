import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { CREDITS_ENABLED, redeem } from "@/lib/icfo-events/credits";

export const dynamic = "force-dynamic";

/** Redeem a catalog item for the signed-in user. */
export async function POST(req: NextRequest): Promise<Response> {
  if (!CREDITS_ENABLED) return NextResponse.json({ error: "Credits are not enabled." }, { status: 404 });
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = (await req.json().catch(() => null)) as { itemId?: string } | null;
    const itemId = body?.itemId?.trim();
    if (!itemId) return NextResponse.json({ error: "Missing item." }, { status: 400 });
    const result = await redeem(profile.id, itemId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't redeem right now." }, { status: 500 });
  }
}
