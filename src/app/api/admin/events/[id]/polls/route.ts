import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createPoll, closePoll } from "@/lib/icfo-events/polls";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  question: z.string().min(1).max(200),
  options: z.array(z.string().min(1).max(80)).min(2).max(5),
});
const closeSchema = z.object({ pollId: z.string().uuid() });

/** Create a poll (staff). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid poll." }, { status: 400 });
    const poll = await createPoll(auth.supabase, id, parsed.data.question, parsed.data.options, auth.profile.id);
    return NextResponse.json({ poll });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create poll." }, { status: 500 });
  }
}

/** Close a poll (staff). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = closeSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await closePoll(auth.supabase, id, parsed.data.pollId, auth.profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to close poll." }, { status: 500 });
  }
}
