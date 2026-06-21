import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { updateCalendarEvent, cancelCalendarEvent } from "@/lib/integrations/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  startTime: z.string().datetime({ offset: true }).optional(),
  endTime: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().optional(),
  location: z.string().max(500).nullish(),
});

async function token(userId: string): Promise<string | { error: Response }> {
  const t = await getValidGoogleAccessToken(userId);
  if (!("accessToken" in t) || !t.accessToken) {
    return { error: NextResponse.json({ error: "Google is not connected." }, { status: 400 }) };
  }
  return t.accessToken;
}

/** PATCH — edit a Google Calendar event directly (partial update; unspecified fields preserved). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event update." }, { status: 400 });

  const tk = await token(auth.profile.id);
  if (typeof tk !== "string") return tk.error;

  try {
    // The Google helper supports title/time/timezone (not location); send those.
    await updateCalendarEvent(id, {
      title: parsed.data.title,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      timezone: parsed.data.timezone,
    }, tk);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

/** DELETE — remove a Google Calendar event. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tk = await token(auth.profile.id);
  if (typeof tk !== "string") return tk.error;

  try {
    await cancelCalendarEvent(id, tk);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
