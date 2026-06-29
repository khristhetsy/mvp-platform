import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { createHelpRequest } from "@/lib/icfo-events/help-desk";

export const dynamic = "force-dynamic";

const schema = z.object({ message: z.string().min(1).max(500) });

/** Attendee files a help request for the event's control-room staff. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  try {
    const { slug } = await params;
    const profile = await getCurrentUserProfile();
    if (!profile) return NextResponse.json({ error: "Sign in to ask for help." }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const supabase = await createServerSupabaseClient();
    const event = await getEventBySlug(supabase, slug).catch(() => null);
    if (!event || event.status === "draft" || event.status === "archived") {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    await createHelpRequest(supabase, event.id, profile.id, parsed.data.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't send your request." }, { status: 500 });
  }
}
