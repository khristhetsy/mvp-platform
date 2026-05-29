import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api/errors";
import { requireApiProfile } from "@/lib/api/auth";
import { adminDebug } from "@/lib/debug/admin-debug";
import { writeAuditLog } from "@/lib/data/audit";
import { publishCampaign } from "@/lib/data/campaigns";

export async function POST(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await params;

  adminDebug({
    scope: "api.admin.campaign.publish",
    action: "request_received",
    companyId: id,
    path: `/api/admin/campaigns/${id}/publish`,
  });

  const auth = await requireApiProfile(["admin"]);

  if ("error" in auth) {
    adminDebug({
      scope: "api.admin.campaign.publish",
      companyId: id,
      error: { message: "Admin auth failed." },
    });
    return auth.error ?? NextResponse.json({ error: "Authentication failed." }, { status: 401 });
  }

  adminDebug({
    scope: "api.admin.campaign.publish",
    userId: auth.profile.id,
    userRole: auth.profile.role,
    companyId: id,
    query: "campaigns.update(status=published)",
    meta: { usesUserSessionClient: true },
  });

  const { data, error } = await publishCampaign(auth.supabase, id);

  if (error) {
    const message = apiErrorMessage(error);
    adminDebug({
      scope: "api.admin.campaign.publish",
      userId: auth.profile.id,
      userRole: auth.profile.role,
      companyId: id,
      error,
      status: 400,
      response: { error: message },
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "campaign.published",
    entityType: "campaign",
    entityId: id,
  });

  adminDebug({
    scope: "api.admin.campaign.publish",
    userId: auth.profile.id,
    userRole: auth.profile.role,
    companyId: id,
    status: 200,
    response: { campaign: data },
  });

  return NextResponse.json({ campaign: data });
}
