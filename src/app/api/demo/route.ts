import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { generateDemoSlots, FIRM_TIMEZONE } from "@/lib/marketing-site/demo-slots";

/**
 * Demo booking (spec §9). GET → available slots (server-generated in the firm's
 * timezone, UTC ISO). POST → validate, insert a marketing_site_demo_bookings row
 * (service role), generate a personalised note via the confirm_demo AI task
 * (best-effort, guardrailed), send a real confirmation email with the .ics
 * attached, and return the note + .ics for the in-page confirmation. No calendar
 * send, no anon read of the table. Every surface keeps the walkthrough-optional line.
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
  source_page: z.string().max(200).optional(),
});

const DURATION_MIN = 30;

function walkthroughLabel(role: "founder" | "investor"): string {
  return role === "founder" ? "iCapOS founder walkthrough" : "iCapOS investor walkthrough";
}

/** RFC-5545 VEVENT the browser/email can import. */
function buildIcs(input: { role: "founder" | "investor"; name: string; email: string; startIso: string; note: string }): string {
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + DURATION_MIN * 60_000);
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
    `SUMMARY:${esc(walkthroughLabel(input.role))}`,
    `DESCRIPTION:${esc(input.note)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Best-effort personalised note via the confirm_demo task; falls back to a
 *  solid template. Always self-serve-optional per §9/§13. */
async function confirmationNote(origin: string, input: { role: "founder" | "investor"; name: string; startIso: string }): Promise<string> {
  const whenFirm = new Intl.DateTimeFormat("en-US", {
    timeZone: FIRM_TIMEZONE, weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(input.startIso));
  const fallback = `Thanks ${input.name.split(" ")[0]} — your ${walkthroughLabel(input.role)} is requested for ${whenFirm}. We'll confirm by email. The walkthrough is optional; everything on iCapOS is self-serve without one.`;
  try {
    const res = await fetch(`${origin}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "confirm_demo",
        messages: [{ role: "user", content: `Name: ${input.name}\nRole: ${input.role}\nTime: ${whenFirm}` }],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json().catch(() => null)) as { ok?: boolean; text?: string } | null;
    return data?.ok && data.text ? data.text : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ slots: generateDemoSlots(), firmTimezone: FIRM_TIMEZONE });
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
      role: d.role, name: d.name, email: d.email,
      company: d.company ?? null, topic: d.topic ?? null,
      requested_at: d.requested_at, duration_minutes: DURATION_MIN,
      source_page: d.source_page ?? null, status: "requested",
    });
  } catch {
    // Non-fatal — still confirm so the visitor isn't blocked.
  }

  const origin = new URL(req.url).origin;
  const note = await confirmationNote(origin, { role: d.role, name: d.name, startIso: d.requested_at });
  const ics = buildIcs({ role: d.role, name: d.name, email: d.email, startIso: d.requested_at, note });

  // Real confirmation email with the .ics attached (best-effort; silent without RESEND_API_KEY).
  const icsBase64 = Buffer.from(ics, "utf-8").toString("base64");
  await sendEmail({
    to: d.email,
    subject: `Your ${walkthroughLabel(d.role)} — requested`,
    html: `<p>${note.replace(/</g, "&lt;")}</p><p style="color:#5B6B85;font-size:12px">The walkthrough is optional and everything on iCapOS is self-serve without one. iCapOS does not offer or sell securities or process transactions.</p>`,
    text: `${note}\n\nThe walkthrough is optional and everything on iCapOS is self-serve without one.`,
    attachments: [{ filename: "icapos-walkthrough.ics", content: icsBase64 }],
  }).catch(() => false);

  return NextResponse.json({ ok: true, message: note, ics });
}
