import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { requestFounderPlatformIntro } from "@/lib/founder-crm/founder-platform-intro";
import { updateOutreachTarget } from "@/lib/founder-crm/outreach";
import { notifyFounderPipelineIntroRequested } from "@/lib/notifications/founder-outreach-events";
import { founderPipelineIntroSchema } from "@/lib/validation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { capReached, loadIntroQuota } from "@/lib/matching/intro-quota";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = founderPipelineIntroSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid intro request." }, { status: 400 });
  }

  const { data: target, error: targetError } = await auth.supabase
    .from("founder_outreach_targets")
    .select("*")
    .eq("id", id)
    .eq("founder_id", auth.profile.id)
    .eq("company_id", auth.company.id)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json({ error: "Outreach target not found." }, { status: 404 });
  }

  if (!target.platform_investor_id) {
    return NextResponse.json(
      { error: "Intro requests are only available for platform matched investors." },
      { status: 400 },
    );
  }

  // Same plan rules as introductions from the matches page: Free founders see
  // investors but can't contact them, and paid plans stay within their limits.
  const plan = await getUserPlan(auth.profile.id);
  if (!founderEntitlements(plan).canBrokerIntros) {
    return NextResponse.json(
      { error: "Introduction requests are included in Basic and Professional. Choose a plan to request introductions.", code: "upgrade_required" },
      { status: 403 },
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quota = await loadIntroQuota(createServiceRoleClient() as any, { companyId: auth.company.id, founderId: auth.profile.id, plan });
  const over = capReached(quota);
  if (over) {
    const limit = over === "week" ? quota.week?.cap : quota.month.cap;
    return NextResponse.json(
      { error: `You've used all ${limit} introduction requests for this ${over}.`, code: "connection_cap_reached", cap: limit, period: over },
      { status: 429 },
    );
  }

  const threadResult = await requestFounderPlatformIntro(auth.supabase, {
    company: auth.company,
    founderId: auth.profile.id,
    platformInvestorId: target.platform_investor_id,
    message: parsed.data.message,
  });

  if (threadResult.error || !threadResult.data) {
    const message = threadResult.error?.message ?? "Unable to open intro message thread.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await updateOutreachTarget(auth.supabase, {
    targetId: id,
    founderId: auth.profile.id,
    patch: { status: "intro_requested" },
  });

  void notifyFounderPipelineIntroRequested({
    founderId: auth.profile.id,
    targetId: id,
    threadId: threadResult.data.thread.id,
  });

  return NextResponse.json({
    thread: threadResult.data.thread,
    threadUrl: `/founder/messages/${threadResult.data.thread.id}`,
  });
}
