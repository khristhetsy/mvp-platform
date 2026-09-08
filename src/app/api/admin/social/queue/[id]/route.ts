/**
 * Per-queue-item actions (build-spec §9). PATCH edits the body, archives, or requeues a
 * variant; DELETE removes it. Published variants are immutable (already live on the
 * platform) — only Archive is allowed on them. Staff-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

const patchSchema = z.object({
  action: z.enum(["edit", "archive", "requeue"]),
  body: z.string().max(4000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const { data: variant } = await db().from("social_variants").select("status").eq("id", id).maybeSingle();
  if (!variant) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (variant.status === "published" && parsed.data.action !== "archive") {
    return NextResponse.json({ error: "Published posts can't be edited or requeued — it's already live." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (parsed.data.action === "edit") {
    if (!parsed.data.body?.trim()) return NextResponse.json({ error: "Body can't be empty." }, { status: 400 });
    update.body = parsed.data.body.trim();
  } else if (parsed.data.action === "archive") {
    update.status = "archived";
  } else if (parsed.data.action === "requeue") {
    update.status = "queued"; update.attempts = 0; update.next_attempt_at = null; update.error = null;
  }
  const { error } = await db().from("social_variants").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const { error } = await db().from("social_variants").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
