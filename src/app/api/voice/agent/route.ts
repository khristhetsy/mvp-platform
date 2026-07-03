import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { runAgentTurn } from "@/lib/voice/agent";

export const dynamic = "force-dynamic";

// Custom-LLM webhook for the voice runtime (Vapi/Retell). Vendor-neutral.
// Two guards before anything runs: the master kill-switch, and a shared secret.
// Dormant until VOICE_OUTBOUND_ENABLED + VOICE_AGENT_SECRET are both set.

const bodySchema = z.object({
  contactId: z.string().min(1),
  audience: z.enum(["founder", "investor"]),
  contactName: z.string().nullish(),
  weakestDimension: z.string().nullish(),
  phone: z.string().nullish(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
});

export async function POST(req: NextRequest): Promise<Response> {
  if (!voiceOutboundEnabled()) {
    return NextResponse.json({ error: "Voice outbound is disabled." }, { status: 503 });
  }

  const secret = process.env.VOICE_AGENT_SECRET?.trim();
  if (!secret || req.headers.get("x-voice-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const result = await runAgentTurn(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Agent turn failed." }, { status: 500 });
  }
}
