/**
 * GET  /api/founder/team  — list current members + pending invites for the founder's company
 * POST /api/founder/team  — send a team invite by email
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { emailTeamInvite } from "@/lib/email/deal-room-emails";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export async function GET(request: Request) {
  void request;
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 404 });

  const admin = createServiceRoleClient();

  // Members
  const { data: members, error: membersError } = await admin
    .from("company_members")
    .select("id, role, created_at, user_id, profiles:profiles!inner(full_name, email, avatar_url)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: true });

  if (membersError) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  // Pending invites
  const { data: invites, error: invitesError } = await admin
    .from("company_invites")
    .select("id, invitee_email, role, status, created_at, expires_at")
    .eq("company_id", company.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (invitesError) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  return NextResponse.json({ members: members ?? [], invites: invites ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 404 });

  const admin = createServiceRoleClient();

  // Check caller is owner or admin
  const { data: myMember, error: myMemberError } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", company.id)
    .eq("user_id", auth.profile.id)
    .maybeSingle();

  if (myMemberError) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  if (!myMember || !["owner", "admin"].includes(myMember.role)) {
    return NextResponse.json({ error: "Only owners and admins can invite members." }, { status: 403 });
  }

  // Check if user is already a member
  const { data: existingMember } = await admin
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (existingMember) {
    const { data: alreadyMember } = await admin
      .from("company_members")
      .select("id")
      .eq("company_id", company.id)
      .eq("user_id", existingMember.id)
      .maybeSingle();

    if (alreadyMember) {
      return NextResponse.json({ error: "This person is already a member." }, { status: 409 });
    }
  }

  // Revoke any existing pending invite for this email+company. Checked: if the
  // revoke fails, stop rather than create a second live invite for the same
  // person while reporting the old one revoked.
  const { error: revokeError } = await admin
    .from("company_invites")
    .update({ status: "revoked" })
    .eq("company_id", company.id)
    .eq("invitee_email", parsed.data.email)
    .eq("status", "pending");
  if (revokeError) {
    return NextResponse.json({ error: "Unable to update the existing invite." }, { status: 500 });
  }

  // Create new invite
  const { data: invite, error } = await admin
    .from("company_invites")
    .insert({
      company_id: company.id,
      inviter_id: auth.profile.id,
      invitee_email: parsed.data.email,
      role: parsed.data.role,
    })
    .select("id, token")
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Failed to create invite." }, { status: 500 });
  }

  // Send invite email fire-and-forget
  void emailTeamInvite({
    inviteeEmail: parsed.data.email,
    inviterName: auth.profile.full_name ?? auth.profile.email ?? "Your co-founder",
    companyName: company.company_name,
    inviteToken: invite.token,
  });

  return NextResponse.json({ success: true, inviteId: invite.id });
}
