import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { loadEventMergeData } from "@/lib/event-email/merge";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Full EventMergeData for an event (server-built, Zod-validated in the lib). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const merge = await loadEventMergeData(auth.supabase, id, { baseUrl: BASE_URL });
    if (!merge) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json({ merge });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't build merge data." }, { status: 500 });
  }
}
