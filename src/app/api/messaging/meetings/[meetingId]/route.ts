import { NextResponse } from "next/server";
import { loadThreadForUser, requireFounderMessagingApi, requireInvestorApprovedApi } from "@/lib/api/messaging";
import { updateThreadMeeting } from "@/lib/messaging/meetings";
import type { ThreadMeetingRecord } from "@/lib/messaging/types";
import { threadMeetingUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ meetingId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { meetingId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = threadMeetingUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid meeting update." }, { status: 400 });
  }

  const meetingInput = parsed.data;

  async function handle(
    profile: { id: string; role: string },
    serviceSupabase: ReturnType<typeof import("@/lib/supabase/admin").createServiceRoleClient>,
  ) {
    const { data: meeting, error: meetingError } = await serviceSupabase
      .from("thread_meetings")
      .select("*")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    }

    const loaded = await loadThreadForUser(
      meeting.thread_id,
      profile.id,
      profile.role as "founder",
      serviceSupabase,
    );
    if ("error" in loaded) {
      return loaded.error;
    }

    const result = await updateThreadMeeting(serviceSupabase, {
      meeting: meeting as ThreadMeetingRecord,
      thread: loaded.thread,
      actorUserId: profile.id,
      action: meetingInput.action,
      proposedStartTime: meetingInput.proposedStartTime,
      proposedEndTime: meetingInput.proposedEndTime,
      timezone: meetingInput.timezone,
      meetingNotes: meetingInput.meetingNotes,
    });

    if (result.error) {
      return NextResponse.json({ error: "Unable to update meeting." }, { status: 400 });
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
