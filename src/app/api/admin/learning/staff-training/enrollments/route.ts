import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { service } from "@/lib/learning/staff-training/data";
import { isCoachTone } from "@/lib/learning/coach/tones";

/** PATCH: coach switch/style, or remove access. Staff only. */
export async function PATCH(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof b.id !== "string") return NextResponse.json({ error: "id is required." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof b.coachOn === "boolean") patch.coach_on = b.coachOn;
  if (b.coachTone !== undefined) {
    if (!isCoachTone(b.coachTone)) return NextResponse.json({ error: "Unknown coaching style." }, { status: 400 });
    patch.coach_tone = b.coachTone;
  }
  if (b.remove === true) patch.status = "removed";
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const { error } = await service().from("staff_training_enrollments").update(patch).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
