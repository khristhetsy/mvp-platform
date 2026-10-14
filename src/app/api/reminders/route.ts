import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { isReminderKind } from "@/lib/reminders/types";

export const dynamic = "force-dynamic";

// user_reminders isn't in the generated types, so use a raw client.
const raw = (client: unknown) => client as SupabaseClient;

/** The person's open reminders plus anything they finished in the last 24 hours. */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await raw(auth.supabase)
    .from("user_reminders")
    .select("id, title, kind, due_at, done_at")
    .eq("user_id", auth.profile.id)
    .or(`done_at.is.null,done_at.gte.${since}`)
    .order("due_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: "Couldn't load reminders." }, { status: 500 });
  return NextResponse.json({ reminders: data ?? [] });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { title?: unknown; kind?: unknown; dueAt?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200) return NextResponse.json({ error: "Enter a title up to 200 characters." }, { status: 400 });
  if (!isReminderKind(body?.kind)) return NextResponse.json({ error: "Pick a reminder type." }, { status: 400 });
  const due = typeof body?.dueAt === "string" ? new Date(body.dueAt) : null;
  if (!due || Number.isNaN(due.getTime())) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
  const { data, error } = await raw(auth.supabase)
    .from("user_reminders")
    .insert({ user_id: auth.profile.id, title, kind: body.kind, due_at: due.toISOString() })
    .select("id, title, kind, due_at, done_at")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't save the reminder." }, { status: 500 });
  return NextResponse.json({ reminder: data }, { status: 201 });
}
