import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { track } from "@/lib/analytics/posthog";
import { duplicateEvent } from "@/lib/icfo-events/queries";
import { logEventActivity } from "@/lib/icfo-events/activity";

export const dynamic = "force-dynamic";

const optionsSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    branding: z.boolean().optional(),
    sessions: z.boolean().optional(),
    sponsors: z.boolean().optional(),
  })
  .default({});

/** Duplicate an existing event into a fresh draft (staff). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = optionsSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const event = await duplicateEvent(auth.supabase, auth.profile.id, id, parsed.data);
    await logEventActivity(auth.supabase, event.id, auth.profile.id, "created", {
      title: event.title,
      duplicatedFrom: id,
    });
    track("event_duplicated", { userId: auth.profile.id, eventId: event.id, sourceId: id });
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to duplicate event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
