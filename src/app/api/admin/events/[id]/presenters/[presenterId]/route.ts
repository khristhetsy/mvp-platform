import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { updatePresenter, deletePresenter } from "@/lib/icfo-events/applications";

export const dynamic = "force-dynamic";

const schema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  roleLabel: z.string().max(120).nullable().optional(),
  headline: z.string().max(300).nullable().optional(),
  bio: z.string().max(3000).nullable().optional(),
  companySummary: z.string().max(3000).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal("")),
  links: z.array(z.string().url()).max(6).optional(),
  startsAt: z.string().datetime().nullable().optional().or(z.literal("")),
  timezone: z.string().max(64).nullable().optional(),
  meetingUrl: z.string().url().max(2000).nullable().optional().or(z.literal("")),
});

/** Edit a presenter (staff). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; presenterId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { presenterId } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    const d = parsed.data;
    const presenter = await updatePresenter(auth.supabase, presenterId, {
      ...d,
      email: d.email === "" ? null : d.email,
      meetingUrl: d.meetingUrl === "" ? null : d.meetingUrl,
      startsAt: d.startsAt === "" ? null : d.startsAt,
    });
    return NextResponse.json({ presenter });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update presenter." }, { status: 500 });
  }
}

/** Remove a presenter from the roster (staff). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; presenterId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { presenterId } = await params;
    await deletePresenter(auth.supabase, presenterId);
    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to remove presenter." }, { status: 500 });
  }
}
