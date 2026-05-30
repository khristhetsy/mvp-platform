import { NextResponse } from "next/server";
import { loadThreadForUser, requireFounderMessagingApi, requireInvestorApprovedApi } from "@/lib/api/messaging";
import { createThreadMeeting } from "@/lib/messaging/meetings";
import { threadMeetingCreateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { threadId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = threadMeetingCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid meeting request." }, { status: 400 });
  }

  const meetingInput = parsed.data;

  async function handle(
    profile: { id: string; role: string },
    serviceSupabase: ReturnType<typeof import("@/lib/supabase/admin").createServiceRoleClient>,
  ) {
    const loaded = await loadThreadForUser(threadId, profile.id, profile.role as "founder", serviceSupabase);
    if ("error" in loaded) {
      return loaded.error;
    }

    const result = await createThreadMeeting(serviceSupabase, {
      thread: loaded.thread,
      requestedBy: profile.id,
      proposedStartTime: meetingInput.proposedStartTime ?? null,
      proposedEndTime: meetingInput.proposedEndTime ?? null,
      timezone: meetingInput.timezone ?? "UTC",
      meetingTitle: meetingInput.meetingTitle ?? null,
      meetingNotes: meetingInput.meetingNotes ?? null,
    });

    if (result.error) {
      return NextResponse.json({ error: "Unable to create meeting request." }, { status: 400 });
    }

    return NextResponse.json({ meeting: result.data });
  }

  const founderAuth = await requireFounderMessagingApi();
  if (!("error" in founderAuth)) {
    return handle(founderAuth.profile, founderAuth.serviceSupabase);
  }

  const investorAuth = await requireInvestorApprovedApi();
  if ("error" in investorAuth) {
    return founderAuth.error ?? investorAuth.error;
  }

  return handle(investorAuth.profile, investorAuth.serviceSupabase);
}
