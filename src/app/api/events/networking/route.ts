import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/posthog";
import { networkingOptinSchema } from "@/lib/icfo-events/schemas";
import { upsertOptin } from "@/lib/icfo-events/networking";

export const dynamic = "force-dynamic";

/** Set the current user's opt-in + interests for an event's networking. */
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireUserProfile();
  try {
    const parsed = networkingOptinSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const supabase = await createServerSupabaseClient();
    const optin = await upsertOptin(
      supabase,
      parsed.data.eventId,
      profile.id,
      parsed.data.optedIn,
      parsed.data.interests,
    );
    track("event_networking_optin", { userId: profile.id, eventId: parsed.data.eventId, optedIn: optin.optedIn });
    return NextResponse.json({ optin });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update networking preferences." }, { status: 500 });
  }
}
