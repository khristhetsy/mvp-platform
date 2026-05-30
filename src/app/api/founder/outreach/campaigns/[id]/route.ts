import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { listOutreachMessages, queueOutreachCampaign } from "@/lib/founder-crm/outreach";
import { evaluateFounderOutreachReadiness } from "@/lib/founder-crm/outreach-readiness";
import {
  notifyFounderOutreachBlocked,
} from "@/lib/notifications/founder-outreach-events";
import { outreachCampaignQueueSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = outreachCampaignQueueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign action." }, { status: 400 });
  }

  const readiness = await evaluateFounderOutreachReadiness(auth.company, auth.profile.id);
  if (!readiness.allowed) {
    const reason = "Complete outreach readiness requirements before queueing messages.";
    void notifyFounderOutreachBlocked({ founderId: auth.profile.id, reason });
    return NextResponse.json({ error: reason, readiness }, { status: 403 });
  }

  const messages = await listOutreachMessages(auth.supabase, id);
  const draftIds = (messages.data ?? [])
    .filter((row) => row.status === "draft")
    .map((row) => row.id as string);

  const result = await queueOutreachCampaign(auth.supabase, {
    campaignId: id,
    founderId: auth.profile.id,
    messageIds: draftIds,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error.message ?? "Unable to queue campaign." }, { status: 400 });
  }

  return NextResponse.json({
    campaign: result.data,
    notice: "Campaign queued internally. No external emails were sent.",
  });
}
