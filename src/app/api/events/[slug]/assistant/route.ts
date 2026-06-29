import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { getEventBySlug } from "@/lib/icfo-events/queries";
import { getMemberStats } from "@/lib/icfo-events/gamification";
import { buildEventContext, answerEventQuestion } from "@/lib/icfo-events/assistant";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(10)
    .default([]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  try {
    const { slug } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const event = await getEventBySlug(supabase, slug).catch(() => null);
    if (!event || event.status === "draft" || event.status === "archived") {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const profile = await getCurrentUserProfile().catch(() => null);
    const member = profile
      ? await getMemberStats(supabase, event.id, profile.id).catch(() => null)
      : null;

    const context = buildEventContext(event, member);
    const reply = await answerEventQuestion(parsed.data.history, parsed.data.message, context);
    return NextResponse.json({ reply });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Assistant unavailable." }, { status: 500 });
  }
}
