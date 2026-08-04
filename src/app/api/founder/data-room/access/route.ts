import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { grantDataRoomAccess, revokeDataRoomAccess, listDataRoomAccess } from "@/lib/data-room/access";
import { writeAuditLog } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

const grantSchema = z.object({
  email: z.string().email(),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
  scope: z.enum(["full", "financials"]).optional(),
});
const revokeSchema = z.object({ investorId: z.string().uuid() });

export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ grants: [] });
  return NextResponse.json({ grants: await listDataRoomAccess(company.id) });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const company = await ensureFounderCompanyForUser(auth.profile);
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

  return NextResponse.json({ grants: await listDataRoomAccess(company.id) });
}

export async function DELETE(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const company = await ensureFounderCompanyForUser(auth.profile);
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

  return NextResponse.json({ grants: await listDataRoomAccess(company.id) });
}
