import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/api/permissions";

export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(["backstage", "onstage"]) });

/** Swap a guest on/off stage (staff). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ guestId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { guestId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const db = auth.supabase as unknown as SupabaseClient;
    const { error } = await db.from("session_guests").update({ status: parsed.data.status }).eq("id", guestId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update guest." }, { status: 500 });
  }
}

/** Remove a guest from the roster (staff). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ guestId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { guestId } = await params;
    const db = auth.supabase as unknown as SupabaseClient;
    const { error } = await db.from("session_guests").delete().eq("id", guestId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to remove guest." }, { status: 500 });
  }
}
