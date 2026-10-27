/**
 * DELETE /api/founder/team/[memberId] — remove a team member or revoke a pending invite
 */

import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { writeAuditLog } from "@/lib/data/audit";
import { isActingAsFounder } from "@/lib/admin/acting-central";
import { MANAGED_ICFO_ROLE } from "@/lib/team/managed-icfo-core";

export async function DELETE(
  request: Request,
  { params }: Readonly<{ params: Promise<{ memberId: string }> }>,
) {
  void request;
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  if (await isActingAsFounder()) {
    return NextResponse.json({ error: "Team changes are made by the account Owner." }, { status: 403 });
  }

  const { memberId } = await params;
  const { company } = await getActiveCompanyForUser(auth.profile);
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

  if (!myMember || !["owner", "admin", MANAGED_ICFO_ROLE].includes(myMember.role)) {
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

    if (member.role === MANAGED_ICFO_ROLE) {
      // Only the Owner can end iCFO's management of the account.
      if (myMember.role !== "owner") {
        return NextResponse.json({ error: "Only the account Owner can remove a Managed by iCFO user." }, { status: 403 });
      }
    }

    const { error } = await admin
      .from("company_members")
      .delete()
      .eq("id", memberId)
      .eq("company_id", company.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (member.role === MANAGED_ICFO_ROLE) {
      await writeAuditLog(admin, {
        userId: auth.profile.id,
        action: "team.managed_icfo_removed",
        entityType: "company_member",
        entityId: memberId,
        metadata: { company_id: company.id, removed_user_id: member.user_id },
      });
    }
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
