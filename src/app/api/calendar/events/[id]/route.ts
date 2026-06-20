import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { updateEvent, cancelEvent } from "@/lib/calendar/events";

type RouteContext = { params: Promise<{ id: string }> };

const attendeeSchema = z.object({ email: z.string().email(), name: z.string().optional() });

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).nullish(),
  startTime: z.string().datetime({ offset: true }).optional(),
  endTime: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().optional(),
  location: z.string().max(500).nullish(),
  attendees: z.array(attendeeSchema).max(50).optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (parsed.data.startTime && parsed.data.endTime && new Date(parsed.data.endTime) <= new Date(parsed.data.startTime)) {
    return NextResponse.json({ error: "endTime must be after startTime." }, { status: 400 });
  }

  try {
    const event = await updateEvent(auth.supabase, auth.profile.id, id, parsed.data);
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  try {
    await cancelEvent(auth.supabase, auth.profile.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cancel failed." }, { status: 500 });
  }
}
