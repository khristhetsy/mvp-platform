import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { bookSlot } from "@/lib/scheduling/book";
import { sendBookingEmails } from "@/lib/scheduling/notify";

const schema = z.object({
  hostId: z.string().uuid(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  timezone: z.string().min(1).max(64).default("UTC"),
  title: z.string().max(300).optional(),
  note: z.string().max(2000).nullish(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (new Date(parsed.data.endTime) <= new Date(parsed.data.startTime)) {
    return NextResponse.json({ error: "endTime must be after startTime." }, { status: 400 });
  }
  if (parsed.data.hostId === auth.profile.id) {
    return NextResponse.json({ error: "You can't book a meeting with yourself." }, { status: 400 });
  }

  try {
    const result = await bookSlot({
      hostId: parsed.data.hostId,
      booker: { id: auth.profile.id, email: auth.profile.email, name: auth.profile.full_name },
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      timezone: parsed.data.timezone,
      title: parsed.data.title,
      note: parsed.data.note ?? null,
    });

    // Confirmations are best-effort — a send failure must not fail the booking.
    await sendBookingEmails({
      hostEmail: result.hostEmail,
      hostName: result.hostName,
      bookerEmail: auth.profile.email,
      bookerName: auth.profile.full_name,
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
