import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createPresenter } from "@/lib/icfo-events/applications";

export const dynamic = "force-dynamic";

const schema = z.object({
  displayName: z.string().min(1).max(200),
  roleLabel: z.string().max(120).nullable().optional(),
  headline: z.string().max(300).nullable().optional(),
  bio: z.string().max(3000).nullable().optional(),
  companySummary: z.string().max(3000).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal("")),
  links: z.array(z.string().url()).max(6).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
  meetingUrl: z.string().url().max(2000).nullable().optional().or(z.literal("")),
});

/** Manually add a presenter to an event's roster (staff). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    const d = parsed.data;
    const presenter = await createPresenter(auth.supabase, {
      eventId: id,
      displayName: d.displayName,
      roleLabel: d.roleLabel ?? null,
      headline: d.headline ?? null,
      bio: d.bio ?? null,
      companySummary: d.companySummary ?? null,
      email: d.email || null,
      links: d.links ?? [],
      startsAt: d.startsAt ?? null,
      timezone: d.timezone ?? null,
      meetingUrl: d.meetingUrl || null,
    });
    return NextResponse.json({ presenter }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to add presenter." }, { status: 500 });
  }
}
