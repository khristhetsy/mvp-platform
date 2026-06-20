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
});

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (new Date(parsed.data.endTime) <= new Date(parsed.data.startTime)) {
    return NextResponse.json({ error: "endTime must be after startTime." }, { status: 400 });
  }

  // Basic anti-spam: cap bookings per email per hour.
  const limited = await enforceRateLimit({
    bucket: "scheduling-book",
    subjectId: parsed.data.email.toLowerCase(),
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const result = await bookSlot({
      hostId: parsed.data.hostId,
      booker: { id: null, email: parsed.data.email, name: parsed.data.name, phone: parsed.data.phone ?? null },
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      timezone: parsed.data.timezone,
      note: parsed.data.note ?? null,
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
