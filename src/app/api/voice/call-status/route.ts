import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { voiceWebhookAuthorized } from "@/lib/voice/webhook-auth";
import { upsertLiveCall } from "@/lib/voice/live-calls";
import { unwrapVapiStatus } from "@/lib/voice/vapi-adapter";

export const dynamic = "force-dynamic";

// Status-update webhook from the voice runtime (Vapi/Retell) — feeds the Live-now
// monitor. Same two guards as the agent + call-end webhooks: master kill-switch
// and shared secret. Ephemeral; the durable record is call_attempts.

const bodySchema = z.object({
  callId: z.string().min(1),
  status: z.enum(["ringing", "talking", "transferring", "ending"]),
  contactId: z.string().nullish(),
  campaignId: z.string().uuid().nullish(),
  variantId: z.string().uuid().nullish(),
  contactName: z.string().max(160).nullish(),
  company: z.string().max(160).nullish(),
  variantLabel: z.string().max(120).nullish(),
  aiDisclosed: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  if (!voiceOutboundEnabled()) return NextResponse.json({ error: "Voice outbound is disabled." }, { status: 503 });

  if (!voiceWebhookAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.json().catch(() => ({}));
  // Vapi posts { message: { type: "status-update", ... } }; unwrap or take a flat body.
  const isVapi = Boolean((rawBody as { message?: unknown })?.message);
  const body = isVapi ? unwrapVapiStatus(rawBody) : rawBody;
  if (isVapi && !body) return NextResponse.json({ ok: true }); // 'ended'/unknown status — nothing to upsert
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await upsertLiveCall(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not record call status." }, { status: 500 });
  }
}
