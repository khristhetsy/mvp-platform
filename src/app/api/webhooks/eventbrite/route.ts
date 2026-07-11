import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { upsertProviderRegistration } from "@/lib/meetings/registrations";

export const dynamic = "force-dynamic";

// Eventbrite registration webhook (spec §2.5/§9.3). FAIL-CLOSED: requires a configured
// shared secret and a matching signature header; otherwise rejects. The provider's raw
// attendee fetch (OAuth) is intentionally not performed here — the caller (an Eventbrite
// integration/relay) posts the resolved attendee fields, signed with EVENTBRITE_WEBHOOK_SECRET.
const payloadSchema = z.object({
  conference_id: z.string().uuid(),
  external_id: z.string().min(1),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  registrant_type: z.enum(["investor", "founder", "guest"]).nullable().optional(),
  attended: z.boolean().nullable().optional(),
});

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.EVENTBRITE_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 501 });

  const raw = await req.text();
  const sig = req.headers.get("x-eventbrite-signature") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (!sig || !timingSafeEqual(sig, expected)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(JSON.parse(raw || "{}"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  const p = parsed.data;
  try {
    await upsertProviderRegistration(p.conference_id, {
      source: "eventbrite", external_id: p.external_id, name: p.name ?? null,
      email: p.email ?? null, registrant_type: p.registrant_type ?? null, attended: p.attended ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
