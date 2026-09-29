import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { eventImpact, sessionImpact } from "@/lib/icfo-events/impact";

export const dynamic = "force-dynamic";

/**
 * What a destructive action would reach — counted when the dialog opens, not
 * when the page renders, so a confirmation never shows a number that went
 * stale in a tab left open since this morning.
 *
 * `?sessionId=` asks about one session instead of the whole event.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    return NextResponse.json(
      sessionId ? { session: await sessionImpact(sessionId) } : { event: await eventImpact(id) },
    );
  } catch (err) {
    Sentry.captureException(err);
    // The counts are the point of the dialog but not a reason to block it:
    // the caller renders dashes, and the admin decides anyway.
    return NextResponse.json({ error: "Couldn't count the impact." }, { status: 500 });
  }
}
