import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { bookSlot } from "@/lib/scheduling/book";
import { sendBookingEmails } from "@/lib/scheduling/notify";

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
  note: z.string().max(2000).nullish(),
  answers: z.array(z.object({ label: z.string().max(300), value: z.string().max(1000) })).max(20).optional(),
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
      booker: { id: null, email: parsed.data.email, name: parsed.data.name, phone: parsed.data.phone ?? null },
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      timezone: parsed.data.timezone,
      note: parsed.data.note ?? null,
      answers: parsed.data.answers,
    });

    await sendBookingEmails({
      hostEmail: result.hostEmail,
      hostName: result.hostName,
      bookerEmail: parsed.data.email,
      bookerName: parsed.data.name,
      title: result.event.title,
      startTime: result.event.start_time,
      timezone: parsed.data.timezone,
      meetUrl: result.meetUrl,
    }).catch(() => {});

    return NextResponse.json({ event: result.event, meetUrl: result.meetUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to book that time." },
      { status: 409 },
    );
  }
}
