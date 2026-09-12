/**
 * Per-queue-item actions. PATCH edits the body, schedules/reschedules, unschedules,
 * archives, or requeues a variant; DELETE removes it. Scheduling mirrors the post onto
 * the staff member's Google Calendar; unschedule/archive/delete remove that event.
 * Published variants are immutable (already live) — only Archive is allowed on them.
 * Staff-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { syncPostEvent, removePostEvent } from "@/lib/social/gcal-sync";
import { markVariantPublished } from "@/lib/social/queue";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const patchSchema = z.object({
  action: z.enum(["edit", "archive", "requeue", "schedule", "unschedule", "mark_published"]),
  body: z.string().max(4000).optional(),
  scheduledAt: z.string().datetime().optional(),
});

type VariantRow = {
  status: string; body: string; scheduled_at: string | null; gcal_event_id: string | null;
  post: { link_url: string | null; brief: string | null } | null;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const { data: variant } = await db()
    .from("social_variants")
    .select("status, body, scheduled_at, gcal_event_id, post:social_posts(link_url, brief)")
    .eq("id", id)
    .maybeSingle();
  if (!variant) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const v = variant as VariantRow;
  if (v.status === "published" && parsed.data.action !== "archive") {
    return NextResponse.json({ error: "Published posts can't be changed — it's already live." }, { status: 409 });
  }

  // "It did reach the platform after all" — only meaningful for a variant the queue
  // stranded mid-publish, where we genuinely don't know whether it went out.
  if (parsed.data.action === "mark_published") {
    if (v.status !== "interrupted" && v.status !== "failed") {
      return NextResponse.json({ error: "Only an interrupted or failed post can be marked published." }, { status: 409 });
    }
    const ok = await markVariantPublished(id);
    return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  const titleFor = (bodyOverride?: string) => ((v.post?.brief?.trim() || bodyOverride || v.body || "Social post").split("\n")[0].slice(0, 80));

  if (parsed.data.action === "edit") {
    if (!parsed.data.body?.trim()) return NextResponse.json({ error: "Body can't be empty." }, { status: 400 });
    update.body = parsed.data.body.trim();
    // Keep an existing calendar event's notes in sync with the edited body.
    if (v.gcal_event_id && v.scheduled_at) {
      await syncPostEvent({ userId: profile.id, existingEventId: v.gcal_event_id, title: titleFor(parsed.data.body), startISO: v.scheduled_at, notes: parsed.data.body.trim() });
    }
  } else if (parsed.data.action === "schedule") {
    if (!parsed.data.scheduledAt) return NextResponse.json({ error: "A date and time are required." }, { status: 400 });
    const eventId = await syncPostEvent({ userId: profile.id, existingEventId: v.gcal_event_id, title: titleFor(), startISO: parsed.data.scheduledAt, notes: v.body });
    update.status = "queued";
    update.scheduled_at = parsed.data.scheduledAt;
    update.next_attempt_at = parsed.data.scheduledAt;
    update.attempts = 0;
    update.error = null;
    update.gcal_event_id = eventId;
  } else if (parsed.data.action === "unschedule") {
    await removePostEvent(profile.id, v.gcal_event_id);
    update.status = "parked";
    update.scheduled_at = null;
    update.next_attempt_at = null;
    update.gcal_event_id = null;
    update.error = null;
  } else if (parsed.data.action === "archive") {
    await removePostEvent(profile.id, v.gcal_event_id);
    update.status = "archived";
    update.gcal_event_id = null;
  } else if (parsed.data.action === "requeue") {
    update.status = v.scheduled_at ? "queued" : "parked";
    update.attempts = 0;
    update.next_attempt_at = v.scheduled_at;
    update.error = null;
  }

  const { error } = await db().from("social_variants").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const { data: variant } = await db().from("social_variants").select("gcal_event_id").eq("id", id).maybeSingle();
  if (variant?.gcal_event_id) await removePostEvent(profile.id, variant.gcal_event_id as string);
  const { error } = await db().from("social_variants").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
