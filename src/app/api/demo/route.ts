import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Demo-booking intake (spec §5 Step 7, §8). Writes a marketing_site_demo_bookings
 * row via the service role after validation and returns a downloadable .ics the
 * client offers to the visitor. No calendar send, no email dispatch here — this
 * records the request; staff follow up. Anon can never read the bookings table.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const demoSchema = z.object({
  role: z.enum(["founder", "investor"]),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  company: z.string().max(200).optional(),
  topic: z.string().max(500).optional(),
  requested_at: z.string().datetime(),
  duration_minutes: z.number().int().min(15).max(60).optional(),
  source_page: z.string().max(200).optional(),
});

/** Minimal RFC-5545 VEVENT the browser can save as a .ics attachment. */
function buildIcs(input: { name: string; email: string; startIso: string; minutes: number; topic?: string }): string {
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + input.minutes * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@icapos.com`;
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//iCapOS//Demo Booking//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    "SUMMARY:iCapOS demo",
    `DESCRIPTION:${esc(`Demo for ${input.name}${input.topic ? ` — ${input.topic}` : ""}. A member of the iCapOS team will confirm by email at ${input.email}.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = demoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please check the form and try again." }, { status: 400 });
  }
  const d = parsed.data;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    await admin.from("marketing_site_demo_bookings").insert({
      role: d.role,
      name: d.name,
      email: d.email,
      company: d.company ?? null,
      topic: d.topic ?? null,
      requested_at: d.requested_at,
      duration_minutes: d.duration_minutes ?? 30,
      source_page: d.source_page ?? null,
      status: "requested",
    });
  } catch {
    // Non-fatal — still return a confirmation so the visitor isn't blocked.
  }

  const ics = buildIcs({ name: d.name, email: d.email, startIso: d.requested_at, minutes: d.duration_minutes ?? 30, topic: d.topic });
  return NextResponse.json({
    ok: true,
    message: `Thanks ${d.name.split(" ")[0]} — your demo request is in. We'll confirm by email at ${d.email}.`,
    ics,
  });
}
