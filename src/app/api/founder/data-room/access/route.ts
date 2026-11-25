import { NextResponse } from "next/server";
import { z } from "zod";
import { founderPlanApiBlock } from "@/lib/subscriptions/founder-access";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { grantDataRoomAccess, revokeDataRoomAccess, listDataRoomAccess } from "@/lib/data-room/access";
import { writeAuditLog } from "@/lib/data/audit";
import { emitActivity } from "@/lib/activity/emit";
import { sendTransactionalEmail } from "@/lib/email/transactional-send";
import { absoluteUrl } from "@/lib/activity/email-templates";
import { founderOnePagerPath } from "@/lib/listing/one-pager-link";
import { buildDataRoomInviteEmail } from "@/lib/data-room/invite-email";

export const dynamic = "force-dynamic";

const grantSchema = z.object({
  email: z.string().email(),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
  scope: z.enum(["full", "financials"]).optional(),
  /** Optional note from the founder, sent in the invitation email. */
  message: z.string().trim().max(1000).optional(),
});
const revokeSchema = z.object({ investorId: z.string().uuid() });

export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const planBlock = await founderPlanApiBlock(auth.profile.id);
  if (planBlock) return planBlock;
  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ grants: [] });
  return NextResponse.json({ grants: await listDataRoomAccess(company.id) });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const planBlock = await founderPlanApiBlock(auth.profile.id);
  if (planBlock) return planBlock;
  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 400 });

  const parsed = grantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = createServiceRoleClient();
  const { data: investor } = await admin
    .from("profiles")
    .select("id, role")
    .ilike("email", parsed.data.email.trim())
    .maybeSingle();

  if (!investor || investor.role !== "investor") {
    return NextResponse.json({ error: "No investor account found with that email." }, { status: 404 });
  }

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString()
    : null;

  await grantDataRoomAccess({
    companyId: company.id,
    investorId: investor.id,
    scope: parsed.data.scope,
    expiresAt,
    grantedBy: auth.profile.id,
  });

  try {
    await writeAuditLog(auth.supabase, {
      userId: auth.profile.id,
      action: "data_room.access_granted",
      entityType: "company",
      entityId: company.id,
      metadata: { investorId: investor.id },
    });
  } catch (auditError) {
    console.error("data-room grant audit log failed", auditError);
  }

  // Who can see what is compliance's business, not only the stage owner's.
  emitActivity({
    classKey: "data_room_access_changed",
    actorUserId: auth.profile.id,
    actorRole: "founder",
    companyId: company.id,
    investorId: investor.id,
    entityType: "data_room_access",
    entityId: company.id,
    sourceModule: "data-room-access",
    title: `Granted data-room access to ${parsed.data.email.trim()}`,
    metadata: { scope: parsed.data.scope, expires_at: expiresAt, action: "granted" },
  });

  // Tell the investor. Best effort: the grant already stands if the email fails.
  try {
    const email = buildDataRoomInviteEmail({
      founderName: auth.profile.full_name ?? auth.profile.email ?? "A founder",
      companyName: company.company_name,
      message: parsed.data.message ?? null,
      onePagerUrl: company.is_published && company.slug ? absoluteUrl(founderOnePagerPath(company.slug)) : null,
      appUrl: absoluteUrl("/investor/dashboard"),
      expiresInDays: parsed.data.expiresInDays ?? null,
    });
    await sendTransactionalEmail({
      to: parsed.data.email.trim(),
      subject: email.subject,
      body: email.text,
      html: email.html,
      founderId: investor.id,
      notificationType: "data_room_invite",
      deepLink: "/investor/dashboard",
      entityType: "company",
      entityId: company.id,
      replyTo: auth.profile.email ?? null,
    });
  } catch (emailError) {
    console.error("data-room invite email failed", emailError);
  }

  return NextResponse.json({ grants: await listDataRoomAccess(company.id) });
}

export async function DELETE(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const planBlock = await founderPlanApiBlock(auth.profile.id);
  if (planBlock) return planBlock;
  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 400 });

  const parsed = revokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  await revokeDataRoomAccess(company.id, parsed.data.investorId);

  try {
    await writeAuditLog(auth.supabase, {
      userId: auth.profile.id,
      action: "data_room.access_revoked",
      entityType: "company",
      entityId: company.id,
      metadata: { investorId: parsed.data.investorId },
    });
  } catch (auditError) {
    console.error("data-room revoke audit log failed", auditError);
  }

  emitActivity({
    classKey: "data_room_access_changed",
    actorUserId: auth.profile.id,
    actorRole: "founder",
    companyId: company.id,
    investorId: parsed.data.investorId,
    entityType: "data_room_access",
    entityId: company.id,
    sourceModule: "data-room-access",
    title: "Revoked an investor's data-room access",
    metadata: { action: "revoked" },
  });

  return NextResponse.json({ grants: await listDataRoomAccess(company.id) });
}
