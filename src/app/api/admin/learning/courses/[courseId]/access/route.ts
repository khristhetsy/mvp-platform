import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/** PATCH { accessMode: "open" | "invite_only" }: who can take this course. Staff only. */
export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const { courseId } = await params;
  const b = (await request.json().catch(() => ({}))) as { accessMode?: unknown };
  if (b.accessMode !== "open" && b.accessMode !== "invite_only") {
    return NextResponse.json({ error: "accessMode must be open or invite_only." }, { status: 400 });
  }
  const { error } = await createServiceRoleClient().from("learning_programs").update({ access_mode: b.accessMode }).eq("id", courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, accessMode: b.accessMode });
}
