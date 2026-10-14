import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { isReminderKind } from "@/lib/reminders/types";
import { SALES_ID_PREFIX } from "@/lib/reminders/sales";
import { updateTask } from "@/lib/sales/tasks";

export const dynamic = "force-dynamic";

const raw = (client: unknown) => client as SupabaseClient;

/** Mark a reminder done or not done. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { done?: unknown; title?: unknown; kind?: unknown; dueAt?: unknown } | null;
  const editing = Boolean(body && ("title" in body || "kind" in body || "dueAt" in body));
  if (!editing && typeof body?.done !== "boolean") return NextResponse.json({ error: "Send done as true or false." }, { status: 400 });
  // Sales tasks are completed in Sales, so the task page and the clock stay in step.
  if (id.startsWith(SALES_ID_PREFIX)) {
    if (editing) return NextResponse.json({ error: "Edit Sales tasks from Sales." }, { status: 400 });
    if (auth.profile.role !== "admin" && auth.profile.role !== "analyst") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    try {
      await updateTask(id.slice(SALES_ID_PREFIX.length), { status: body?.done ? "done" : "open" }, auth.profile.id);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Couldn't update the task." }, { status: 500 });
    }
  }
  const patch: Record<string, unknown> = {};
  if (typeof body?.done === "boolean") patch.done_at = body.done ? new Date().toISOString() : null;
  if (body && "title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 200) return NextResponse.json({ error: "Enter a title up to 200 characters." }, { status: 400 });
    patch.title = title;
  }
  if (body && "kind" in body) {
    if (!isReminderKind(body.kind)) return NextResponse.json({ error: "Pick a reminder type." }, { status: 400 });
    patch.kind = body.kind;
  }
  if (body && "dueAt" in body) {
    const due = typeof body.dueAt === "string" ? new Date(body.dueAt) : null;
    if (!due || Number.isNaN(due.getTime())) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
    patch.due_at = due.toISOString();
    patch.notified_at = null; // a new time alerts again
  }
  const { data, error } = await raw(auth.supabase)
    .from("user_reminders")
    .update(patch)
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
  if (id.startsWith(SALES_ID_PREFIX)) return NextResponse.json({ error: "Delete Sales tasks from Sales." }, { status: 400 });
  const { error } = await raw(auth.supabase).from("user_reminders").delete().eq("id", id).eq("user_id", auth.profile.id);
  if (error) return NextResponse.json({ error: "Couldn't delete the reminder." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
