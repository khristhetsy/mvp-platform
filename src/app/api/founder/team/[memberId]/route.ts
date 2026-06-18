/**
 * DELETE /api/founder/team/[memberId] — remove a team member or revoke a pending invite
 */

import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export async function DELETE(
  request: Request,
  { params }: Readonly<{ params: Promise<{ memberId: string }> }>,
) {
  void request;
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { memberId } = await params;
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
    return NextResponse.json({ error: "Only owners and admins can remove members." }, { status: 403 });
  }

  // Try to delete as a member first
  const { data: member } = await admin
    .from("company_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("company_id", company.id)
    .maybeSingle();

  if (member) {
    // Cannot remove the owner
    if (member.role === "owner") {
      return NextResponse.json({ error: "Cannot remove the company owner." }, { status: 400 });
    }
    // Cannot remove yourself
    if (member.user_id === auth.profile.id) {
      return NextResponse.json({ error: "Cannot remove yourself." }, { status: 400 });
    }

    const { error } = await admin
      .from("company_members")
      .delete()
      .eq("id", memberId)
      .eq("company_id", company.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, removed: "member" });
  }

  // Try to revoke as a pending invite
  const { data: invite } = await admin
    .from("company_invites")
    .select("id")
    .eq("id", memberId)
    .eq("company_id", company.id)
    .eq("status", "pending")
    .maybeSingle();

  if (invite) {
    const { error } = await admin
      .from("company_invites")
      .update({ status: "revoked" })
      .eq("id", memberId)
      .eq("company_id", company.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, removed: "invite" });
  }

  return NextResponse.json({ error: "Member or invite not found." }, { status: 404 });
}
