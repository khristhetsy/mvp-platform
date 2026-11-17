import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { syncToCrm } from "@/lib/linkedin/cloud-crm";
import { CloudSenderError, cloudSenderConfig, isUuid } from "@/lib/linkedin/cloud-sender";

export const dynamic = "force-dynamic";

const schema = z.object({ campaignId: z.string().refine(isUuid, "Invalid campaign id."), campaignName: z.string().trim().max(120).optional() });

/** POST { campaignId }: write accepted and replied leads to each CRM contact's Notes log. Safe to repeat. Staff only. */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const cfg = cloudSenderConfig();
  if (!cfg) return NextResponse.json({ error: "The cloud sender is not set up." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });
  try {
    return NextResponse.json(await syncToCrm(cfg, parsed.data.campaignId, parsed.data.campaignName));
  } catch (e) {
    return NextResponse.json({ error: e instanceof CloudSenderError ? e.message : "Could not sync." }, { status: e instanceof CloudSenderError ? e.status : 500 });
  }
}
