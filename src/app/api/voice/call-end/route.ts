import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { recordCallOutcome } from "@/lib/voice/outcomes";

export const dynamic = "force-dynamic";

// Call-end webhook from the voice runtime. Same two guards as the agent route:
// master kill-switch + shared secret. Dormant until both are set.

const bodySchema = z.object({
  contactId: z.string().min(1),
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

  const secret = process.env.VOICE_AGENT_SECRET?.trim();
  if (!secret || req.headers.get("x-voice-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const result = await recordCallOutcome(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Could not record outcome." }, { status: 500 });
  }
}
