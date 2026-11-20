import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { service } from "@/lib/learning/staff-training/data";
import { checkInvite, hashInviteToken, INVITE_DENIED_COPY } from "@/lib/learning/staff-training/invites";

/** POST {token}: the signed in user accepts an invitation. Runs on the server with the token hash. */
export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;
  const b = (await request.json().catch(() => ({}))) as { token?: unknown };
  if (typeof b.token !== "string" || b.token.length < 20) return NextResponse.json({ error: "Invalid invitation." }, { status: 400 });

  const db = service();
  const { data: invite } = await db.from("staff_training_invites").select("*").eq("token_hash", hashInviteToken(b.token)).maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invalid invitation." }, { status: 404 });
  const check = checkInvite(invite, auth.profile.email);
  if (!check.ok) return NextResponse.json({ error: INVITE_DENIED_COPY[check.reason], reason: check.reason }, { status: 403 });

  // Single use: only flip an invite that is still "invited".
  const { data: flipped } = await db.from("staff_training_invites")
    .update({ status: "accepted", accepted_by: auth.profile.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id).eq("status", "invited").select("id");
  if (!flipped || flipped.length === 0) return NextResponse.json({ error: INVITE_DENIED_COPY.used, reason: "used" }, { status: 403 });

  const { error } = await db.from("staff_training_enrollments").upsert({
    user_id: auth.profile.id, invite_id: invite.id, audience: invite.audience,
    organization_label: invite.organization_label, reviewer_label: invite.reviewer_label,
    coach_on: invite.coach_enabled, status: "active",
  }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
