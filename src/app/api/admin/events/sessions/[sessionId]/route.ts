import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { sessionInput } from "@/lib/icfo-events/schemas";
import { updateSession, deleteSession } from "@/lib/icfo-events/sessions";

export const dynamic = "force-dynamic";

/** Update a session (staff). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const parsed = sessionInput.partial().safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const session = await updateSession(auth.supabase, sessionId, parsed.data);
    return NextResponse.json({ session });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update session." }, { status: 500 });
  }
}

/** Delete a session (staff). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    await deleteSession(auth.supabase, sessionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to delete session." }, { status: 500 });
  }
}
