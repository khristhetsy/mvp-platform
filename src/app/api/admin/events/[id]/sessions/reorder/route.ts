import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { reorderSessions } from "@/lib/icfo-events/sessions";

export const dynamic = "force-dynamic";

const schema = z.object({ ids: z.array(z.string()).max(200) });

/** Persist a new session running order for an event (staff). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    await reorderSessions(auth.supabase, id, parsed.data.ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to reorder sessions." }, { status: 500 });
  }
}
