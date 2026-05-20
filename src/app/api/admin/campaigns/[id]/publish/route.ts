import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/data/audit";
import { publishCampaign } from "@/lib/data/campaigns";

export async function POST(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireApiProfile(["admin"]);

  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const { data, error } = await publishCampaign(auth.supabase, id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "campaign.published",
    entityType: "campaign",
    entityId: id,
  });

  return NextResponse.json({ campaign: data });
}
