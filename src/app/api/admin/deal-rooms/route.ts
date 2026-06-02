import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeDealRoomActivity } from "@/lib/deal-rooms/activity";

const createSchema = z.object({
  companyId: z.string().uuid(),
  investorProfileId: z.string().uuid(),
  title: z.string().min(3).max(200),
  status: z.enum(["active", "pending", "archived", "closed"]).default("pending"),
  spvId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
});

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("deal_rooms")
    .select("id, company_id, founder_id, investor_profile_id, investor_user_id, spv_id, campaign_id, status, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: apiErrorMessage(error) }, { status: 400 });
  return NextResponse.json({ rooms: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = createServiceRoleClient();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, founder_id, company_name")
    .eq("id", parsed.data.companyId)
    .maybeSingle();
  if (companyError || !company?.founder_id) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const { data: investor, error: investorError } = await admin
    .from("investor_profiles")
    .select("id, profile_id, approval_status")
    .eq("id", parsed.data.investorProfileId)
    .maybeSingle();
  if (investorError || !investor?.profile_id) {
    return NextResponse.json({ error: "Investor profile not found." }, { status: 404 });
  }

  const payload = {
    company_id: parsed.data.companyId,
    founder_id: company.founder_id,
    investor_profile_id: parsed.data.investorProfileId,
    investor_user_id: investor.profile_id,
    spv_id: parsed.data.spvId ?? null,
    campaign_id: parsed.data.campaignId ?? null,
    status: parsed.data.status,
    title: parsed.data.title,
    updated_at: new Date().toISOString(),
  };

  const { data: room, error } = await admin.from("deal_rooms").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: apiErrorMessage(error) }, { status: 400 });

  await writeDealRoomActivity(admin, {
    roomId: room.id,
    eventType: "room_created",
    actorUserId: auth.profile.id,
    metadata: { company_id: parsed.data.companyId, investor_profile_id: parsed.data.investorProfileId },
  });

  return NextResponse.json({ room });
}

