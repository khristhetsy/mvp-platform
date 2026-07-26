import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import { importArchive } from "@/lib/event-hub/brochure/editions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** Upload a historical booklet PDF into the library as an archived_import (Step 7).
 *  Accepts multipart/form-data: file (application/pdf), title, optional eventId. */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    const eventId = (form.get("eventId") ? String(form.get("eventId")) : null) || null;

    if (!(file instanceof File)) return NextResponse.json({ error: "Attach a PDF file." }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Enter a title for the archive." }, { status: 400 });
    if (file.type && file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF files can be imported." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "PDF is larger than 25 MB." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== "%PDF-") return NextResponse.json({ error: "That file isn't a valid PDF." }, { status: 400 });

    const edition = await importArchive(auth.supabase, { title, eventId, bytes, createdBy: auth.userId });
    return NextResponse.json({ edition });
  } catch (err) {
    Sentry.captureException(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't import. ${detail.slice(0, 200)}` }, { status: 500 });
  }
}
