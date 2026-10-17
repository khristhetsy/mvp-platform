import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";

export const dynamic = "force-dynamic";

const raw = (client: unknown) => client as SupabaseClient;

type RouteContext = { params: Promise<{ noteId: string }> };

/** Pin or unpin a note. */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;
  const { noteId } = await context.params;
  const body = (await request.json().catch(() => null)) as { pinned?: unknown } | null;
  if (typeof body?.pinned !== "boolean") return NextResponse.json({ error: "Send pinned as true or false." }, { status: 400 });
  const { data, error } = await raw(auth.supabase)
    .from("founder_contact_notes")
    .update({ pinned: body.pinned })
    .eq("id", noteId)
    .eq("founder_id", auth.profile.id)
    .select("id, body, pinned, created_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Couldn't update the note." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  return NextResponse.json({ note: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;
  const { noteId } = await context.params;
  const { error } = await raw(auth.supabase)
    .from("founder_contact_notes")
    .delete()
    .eq("id", noteId)
    .eq("founder_id", auth.profile.id);
  if (error) return NextResponse.json({ error: "Couldn't delete the note." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
