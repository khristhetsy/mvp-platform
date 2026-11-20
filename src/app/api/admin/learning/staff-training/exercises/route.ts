import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { service } from "@/lib/learning/staff-training/data";

/** PATCH {id, status: "pass" | "redo"}: the human decision on an exercise. */
export async function PATCH(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const b = (await request.json().catch(() => ({}))) as { id?: unknown; status?: unknown };
  if (typeof b.id !== "string" || (b.status !== "pass" && b.status !== "redo")) {
    return NextResponse.json({ error: "id and a status of pass or redo are required." }, { status: 400 });
  }
  const { error } = await service().from("staff_training_exercises")
    .update({ status: b.status, reviewed_by: auth.profile.id, reviewed_at: new Date().toISOString() }).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
