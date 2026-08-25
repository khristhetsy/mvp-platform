import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { voiceWebhookAuthorized } from "@/lib/voice/webhook-auth";
import { recordCallOutcome } from "@/lib/voice/outcomes";
import { finalizeLiveCall } from "@/lib/voice/live-calls";
import { unwrapVapiCallEnd } from "@/lib/voice/vapi-adapter";

export const dynamic = "force-dynamic";

// Call-end webhook from the voice runtime. Same two guards as the agent route:
// master kill-switch + shared secret. Dormant until both are set.

const bodySchema = z.object({
  contactId: z.string().min(1),
  callId: z.string().nullish(),
  campaignId: z.string().uuid().nullish(),
  variantId: z.string().uuid().nullish(),
  disposition: z.string().min(1).max(60),
  status: z.string().max(60).nullish(),
  booked: z.boolean().optional(),
  transferredTo: z.string().max(120).nullish(),
  duration: z.number().int().nonnegative().nullish(),
  aiDisclosedAt: z.string().datetime({ offset: true }).nullish(),
  transcriptUrl: z.string().url().nullish(),
  recordingUrl: z.string().url().nullish(),
  cost: z.number().nonnegative().nullish(),
});

export async function POST(req: NextRequest): Promise<Response> {
  if (!voiceOutboundEnabled()) return NextResponse.json({ error: "Voice outbound is disabled." }, { status: 503 });

  if (!voiceWebhookAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.json().catch(() => ({}));
  // Accept Vapi's { message: { type: "end-of-call-report", ... } } envelope or a flat body.
  const body = (rawBody as { message?: unknown })?.message ? unwrapVapiCallEnd(rawBody) ?? {} : rawBody;
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const result = await recordCallOutcome(parsed.data);
    if (parsed.data.callId) await finalizeLiveCall(parsed.data.callId); // clear from the live monitor
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not record outcome." }, { status: 500 });
  }
}
