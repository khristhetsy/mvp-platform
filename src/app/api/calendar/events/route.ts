import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { listEvents, createEvent } from "@/lib/calendar/events";

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required." }, { status: 400 });
  }

  const events = await listEvents(auth.supabase, auth.profile.id, from, to);
  return NextResponse.json({ events });
}

const attendeeSchema = z.object({ email: z.string().email(), name: z.string().optional() });

const createSchema = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(5000).nullish(),
    startTime: z.string().datetime({ offset: true }),
    endTime: z.string().datetime({ offset: true }),
    timezone: z.string().default("UTC"),
    allDay: z.boolean().optional(),
    location: z.string().max(500).nullish(),
    attendees: z.array(attendeeSchema).max(50).optional(),
    addMeet: z.boolean().optional(),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "endTime must be after startTime.",
    path: ["endTime"],
  });

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const event = await createEvent(auth.supabase, auth.profile.id, {
    ...parsed.data,
    description: parsed.data.description ?? null,
    location: parsed.data.location ?? null,
  });
  return NextResponse.json({ event });
}
