import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getEdition, updateEdition } from "@/lib/event-hub/brochure/editions";
import type { BrochurePage, BrochureSize } from "@/lib/event-hub/brochure/types";

export const dynamic = "force-dynamic";

/** Fetch one edition. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const edition = await getEdition(auth.supabase, id);
    if (!edition) return NextResponse.json({ error: "Edition not found." }, { status: 404 });
    return NextResponse.json({ edition });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't load the edition." }, { status: 500 });
  }
}

/** Update page_config / overrides / size / title. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      title?: string; pageConfig?: BrochurePage[]; overrides?: Record<string, Record<string, string>>; size?: BrochureSize;
    };
    const edition = await updateEdition(auth.supabase, id, body);
    return NextResponse.json({ edition });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Couldn't save the edition." }, { status: 500 });
  }
}
