import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const raw = (client: unknown) => client as SupabaseClient;

/** Mark a reminder done or not done. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { done?: unknown } | null;
  if (typeof body?.done !== "boolean") return NextResponse.json({ error: "Send done as true or false." }, { status: 400 });
  const { data, error } = await raw(auth.supabase)
    .from("user_reminders")
    .update({ done_at: body.done ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", auth.profile.id)
    .select("id, title, kind, due_at, done_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Couldn't update the reminder." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  return NextResponse.json({ reminder: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { error } = await raw(auth.supabase).from("user_reminders").delete().eq("id", id).eq("user_id", auth.profile.id);
  if (error) return NextResponse.json({ error: "Couldn't delete the reminder." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
