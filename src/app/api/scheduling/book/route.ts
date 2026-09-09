import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { bookSlot } from "@/lib/scheduling/book";
import { sendBookingEmails } from "@/lib/scheduling/notify";
import { cancelBookingByToken } from "@/lib/scheduling/cancel";
import { handoffFitSession } from "@/lib/fit/handoff";

// Public endpoint: anyone with the link can book (guest booking). Booker
// identity comes from the form, not a session.
const schema = z.object({
  hostId: z.string().uuid(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  timezone: z.string().min(1).max(64).default("UTC"),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  company: z.string().max(200).optional(),
  note: z.string().max(2000).nullish(),
  answers: z.array(z.object({ label: z.string().max(300), value: z.string().max(1000) })).max(20).optional(),
  // Present when the booking came from the /fit funnel — triggers the Sales Hub handoff.
  fitSessionId: z.string().uuid().optional(),
  // Present when this booking replaces an existing one (from a reschedule link) —
  // the old booking is cancelled after the new one is confirmed.
  rescheduleToken: z.string().max(600).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (new Date(parsed.data.endTime) <= new Date(parsed.data.startTime)) {
    return NextResponse.json({ error: "endTime must be after startTime." }, { status: 400 });
  }

  // Anti-spam. Rate limiting keyed on the submitted email was effectively no
  // limit at all — the caller picks the email, so a new address per request
  // resets the bucket. Every accepted booking dispatches two emails from our
  // sending domain, so the abuse cost is deliverability reputation on the same
  // domain used for investor mail.
  //
  // Primary limit is per source IP. The per-email limit is kept as a secondary
  // check so one genuine person can't spam a single inbox from many addresses.
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const clientIp = forwardedFor.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

  const ipLimited = await enforceRateLimit({
    bucket: "scheduling-book-ip",
    subjectId: clientIp,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (ipLimited) return ipLimited;

  const emailLimited = await enforceRateLimit({
    bucket: "scheduling-book",
    subjectId: parsed.data.email.toLowerCase(),
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (emailLimited) return emailLimited;

  try {
    const result = await bookSlot({
      hostId: parsed.data.hostId,
      booker: { id: null, email: parsed.data.email, name: parsed.data.name, phone: parsed.data.phone ?? null, company: parsed.data.company ?? null },
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      timezone: parsed.data.timezone,
      note: parsed.data.note ?? null,
      answers: parsed.data.answers,
    });

    // Reschedule: cancel the prior booking now that the new slot is confirmed.
    if (parsed.data.rescheduleToken) {
      await cancelBookingByToken(parsed.data.rescheduleToken, "reschedule", { silent: true }).catch(() => {});
    }

    await sendBookingEmails({
      bookingId: result.bookingId,
      hostEmail: result.hostEmail,
      hostName: result.hostName,
      bookerEmail: parsed.data.email,
      bookerName: parsed.data.name,
      title: result.event.title,
      startTime: result.event.start_time,
      endTime: result.event.end_time,
      timezone: parsed.data.timezone,
      meetUrl: result.meetUrl,
      answers: parsed.data.answers,
    }).catch(() => {});

    // /fit handoff: on a funnel booking, write the lead + four answers to Sales Hub
    // (matched on normalised email; first-touch lead source preserved). The session id
    // comes from the body or the funnel cookie, so booking after the funnel links
    // automatically. Best-effort — never blocks the booking.
    const fitSessionId = parsed.data.fitSessionId ?? req.cookies.get("fs_session")?.value;
    if (fitSessionId) {
      await handoffFitSession(fitSessionId, { name: parsed.data.name, email: parsed.data.email }).catch(() => {});
    }

    return NextResponse.json({ event: result.event, meetUrl: result.meetUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to book that time." },
      { status: 409 },
    );
  }
}
