import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { requestFounderPlatformIntro } from "@/lib/founder-crm/founder-platform-intro";
import { updateOutreachTarget } from "@/lib/founder-crm/outreach";
import { notifyFounderPipelineIntroRequested } from "@/lib/notifications/founder-outreach-events";
import { founderPipelineIntroSchema } from "@/lib/validation";

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
