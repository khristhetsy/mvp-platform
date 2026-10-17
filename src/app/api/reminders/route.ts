import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { isReminderKind } from "@/lib/reminders/types";
import { listSalesReminders } from "@/lib/reminders/sales";
import { attachContactLinks, loadContactNames } from "@/lib/reminders/contact-links";

export const dynamic = "force-dynamic";

// user_reminders isn't in the generated types, so use a raw client.
const raw = (client: unknown) => client as SupabaseClient;

/** The person's open reminders plus anything they finished in the last 24 hours. */
export async function GET(): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const load = (columns: string) =>
    raw(auth.supabase)
      .from("user_reminders")
      .select(columns)
      .eq("user_id", auth.profile.id)
      .or(`done_at.is.null,done_at.gte.${since}`)
      .order("due_at", { ascending: true })
      .limit(100);
  // Reminders set from a contact page carry contact_id. If that column isn't there yet, load without it.
  let result = await load("id, title, kind, due_at, done_at, contact_id");
  if (result.error) result = await load("id, title, kind, due_at, done_at");
  const { data: found, error } = result;
  if (error) return NextResponse.json({ error: "Couldn't load reminders." }, { status: 500 });
  const rows = (found ?? []) as unknown as Array<{ id: string; title: string; kind: string; due_at: string; done_at: string | null; contact_id?: string | null }>;
  const data = attachContactLinks(rows, await loadContactNames(raw(auth.supabase), rows));
  // Sales staff also see their own open Sales tasks here, so a task added on a contact shows in the clock.
  const isSalesStaff = auth.profile.role === "admin" || auth.profile.role === "analyst";
  const sales = isSalesStaff ? await listSalesReminders(auth.profile.id, since) : [];
  const all = [...data, ...sales].sort((a, b) => a.due_at.localeCompare(b.due_at));
  return NextResponse.json({ reminders: all });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { title?: unknown; kind?: unknown; dueAt?: unknown; contactId?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200) return NextResponse.json({ error: "Enter a title up to 200 characters." }, { status: 400 });
  if (!isReminderKind(body?.kind)) return NextResponse.json({ error: "Pick a reminder type." }, { status: 400 });
  const due = typeof body?.dueAt === "string" ? new Date(body.dueAt) : null;
  if (!due || Number.isNaN(due.getTime())) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
  // A task set from a founder's contact page is linked to that contact. It has to be one of their own.
  const contactId = typeof body?.contactId === "string" && body.contactId ? body.contactId : null;
  if (contactId) {
    const { data: contact } = await raw(auth.supabase)
      .from("founder_investor_contacts")
      .select("id")
      .eq("id", contactId)
      .eq("founder_id", auth.profile.id)
      .maybeSingle();
    if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }
  const { data, error } = await raw(auth.supabase)
    .from("user_reminders")
    .insert({ user_id: auth.profile.id, title, kind: body.kind, due_at: due.toISOString(), ...(contactId ? { contact_id: contactId } : {}) })
    .select("id, title, kind, due_at, done_at")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't save the reminder." }, { status: 500 });
  return NextResponse.json({ reminder: data }, { status: 201 });
}
