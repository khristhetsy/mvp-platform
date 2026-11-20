import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { service } from "@/lib/learning/staff-training/data";
import { isTrainingAudience } from "@/lib/learning/staff-training/catalog";
import { generateInviteToken, hashInviteToken, inviteEmail, inviteExpiry, signUpLink, trainingLink } from "@/lib/learning/staff-training/invites";
import { sendTransactionalEmail } from "@/lib/email/transactional-send";

/** POST: create and email an invitation. Staff only. DELETE: revoke one. */
export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!email.includes("@")) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  const audience = isTrainingAudience(b.audience) ? b.audience : "staff";
  const org = typeof b.organizationLabel === "string" && b.organizationLabel.trim() ? b.organizationLabel.trim().slice(0, 120) : "iCFO Capital Global";
  const reviewer = typeof b.reviewerLabel === "string" && b.reviewerLabel.trim() ? b.reviewerLabel.trim().slice(0, 120) : "Senior Tech Support";

  const db = service();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inviterName = auth.profile.full_name ?? "Your iCFO contact";

  // Already a user: access turns on now. Not a user yet: an invitation waits for their sign up.
  const { data: existing } = await db.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing?.id) {
    const { error } = await db.from("staff_training_enrollments").upsert({
      user_id: existing.id, audience, organization_label: org, reviewer_label: reviewer,
      coach_on: b.coachEnabled !== false, status: "active",
    }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db.from("staff_training_invites").insert({
      email, audience, organization_label: org, reviewer_label: reviewer,
      coach_enabled: b.coachEnabled !== false,
      token_hash: hashInviteToken(generateInviteToken()), invited_by: auth.profile.id,
      expires_at: inviteExpiry().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mail = inviteEmail({
    audience, inviterName, existingUser: Boolean(existing?.id),
    signUp: signUpLink(appUrl, email), training: trainingLink(appUrl),
  });
  // Real email goes to the invitee only; the staff sender's id is used for the log.
  await sendTransactionalEmail({
    to: email, subject: mail.subject, body: mail.body, founderId: auth.profile.id,
    notificationType: "staff_training_invite", entityType: "staff_training_invite",
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const b = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (typeof b.id !== "string") return NextResponse.json({ error: "id is required." }, { status: 400 });
  const { error } = await service().from("staff_training_invites").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", b.id).eq("status", "invited");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
