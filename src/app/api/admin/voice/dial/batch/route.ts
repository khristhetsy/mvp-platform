import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { vapiConfigured } from "@/lib/voice/vapi";
import { dialBatch, dialableCount } from "@/lib/voice/segments";

export const dynamic = "force-dynamic";

// Dial one wave of eligible contacts. The client loops this (passing back the
// contact_ids already dialed) until nothing eligible remains or the user stops.
// Every dial passes pre_dial_gate; admin-only; kill-switch gated.

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ dialable: await dialableCount().catch(() => 0) });
}

const bodySchema = z.object({
  waveSize: z.number().int().min(1).max(15).default(5),
  exclude: z.array(z.string()).max(20000).default([]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can place calls." }, { status: 403 });
  if (!voiceOutboundEnabled()) return NextResponse.json({ error: "Voice outbound is disabled." }, { status: 503 });
  if (!vapiConfigured()) return NextResponse.json({ error: "Vapi is not configured." }, { status: 400 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const result = await dialBatch(parsed.data.waveSize, parsed.data.exclude);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Batch dial failed." }, { status: 500 });
  }
}
