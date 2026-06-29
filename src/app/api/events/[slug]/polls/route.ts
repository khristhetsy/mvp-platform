import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { getOpenPoll, getPollResults, castVote } from "@/lib/icfo-events/polls";

export const dynamic = "force-dynamic";

/** Current open poll + live results for an attendee. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  try {
    const { slug } = await params;
    const supabase = await createServerSupabaseClient();
    const event = await getEventBySlug(supabase, slug).catch(() => null);
    if (!event) return NextResponse.json({ poll: null });

    const admin = createServiceRoleClient();
    const poll = await getOpenPoll(admin, event.id);
    if (!poll) return NextResponse.json({ poll: null });

    const profile = await getCurrentUserProfile().catch(() => null);
    const results = await getPollResults(admin, poll, profile?.id);
    return NextResponse.json(results);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ poll: null });
  }
}

const voteSchema = z.object({ pollId: z.string().uuid(), optionIndex: z.number().int().min(0).max(4) });

/** Cast a vote (signed-in attendee). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  try {
    await params;
    const profile = await getCurrentUserProfile();
    if (!profile) return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });

    const parsed = voteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid vote." }, { status: 400 });

    const supabase = await createServerSupabaseClient();
    await castVote(supabase, parsed.data.pollId, profile.id, parsed.data.optionIndex);

    const admin = createServiceRoleClient();
    const { slug } = await params;
    const event = await getEventBySlug(admin, slug).catch(() => null);
    const poll = event ? await getOpenPoll(admin, event.id) : null;
    const results = poll ? await getPollResults(admin, poll, profile.id) : { poll: null };
    return NextResponse.json(results);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Vote failed." }, { status: 500 });
  }
}
