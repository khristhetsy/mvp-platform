import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { removeEventModerator, listEventModerators } from "@/lib/icfo-events/moderators";

export const dynamic = "force-dynamic";

/** Remove a moderator from an event. Super-admin only. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("assign_roles");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, userId } = await params;
    await removeEventModerator(auth.supabase, id, userId, auth.profile.id);
    const moderators = await listEventModerators(auth.supabase, id);
    return NextResponse.json({ moderators });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to remove moderator." }, { status: 500 });
  }
}
