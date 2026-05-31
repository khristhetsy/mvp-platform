import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { loadThreadForUser, requireFounderMessagingApi, requireInvestorApprovedApi } from "@/lib/api/messaging";
import { sendUserMessage } from "@/lib/messaging/threads";
import { threadMessageSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { threadId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = threadMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  const founderAuth = await requireFounderMessagingApi();
  if (!("error" in founderAuth)) {
    const rateLimited = await enforceRateLimit({
      bucket: "thread_message_send",
      subjectId: founderAuth.profile.id,
      limit: 40,
      windowMs: 60_000,
    });
    if (rateLimited) {
      return rateLimited;
    }

    const loaded = await loadThreadForUser(
      threadId,
      founderAuth.profile.id,
      founderAuth.profile.role,
      founderAuth.serviceSupabase,
    );
    if ("error" in loaded) {
      return loaded.error;
    }

    const result = await sendUserMessage(founderAuth.serviceSupabase, {
      thread: loaded.thread,
      senderId: founderAuth.profile.id,
      body: parsed.data.body,
    });

    if (result.error) {
      return NextResponse.json({ error: "Unable to send message." }, { status: 400 });
    }

    return NextResponse.json({ message: result.data });
  }

  const investorAuth = await requireInvestorApprovedApi();
  if ("error" in investorAuth) {
    return founderAuth.error ?? investorAuth.error;
  }

  const rateLimited = await enforceRateLimit({
    bucket: "thread_message_send",
    subjectId: investorAuth.profile.id,
    limit: 40,
    windowMs: 60_000,
  });
  if (rateLimited) {
    return rateLimited;
  }

  const loaded = await loadThreadForUser(
    threadId,
    investorAuth.profile.id,
    investorAuth.profile.role,
    investorAuth.serviceSupabase,
  );
  if ("error" in loaded) {
    return loaded.error;
  }

  const result = await sendUserMessage(investorAuth.serviceSupabase, {
    thread: loaded.thread,
    senderId: investorAuth.profile.id,
    body: parsed.data.body,
  });

  if (result.error) {
    return NextResponse.json({ error: "Unable to send message." }, { status: 400 });
  }

  return NextResponse.json({ message: result.data });
}
