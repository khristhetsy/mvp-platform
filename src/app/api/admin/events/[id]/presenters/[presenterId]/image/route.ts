import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/api/permissions";
import {
  PRESENTER_IMAGE_MAX_BYTES,
  PRESENTER_IMAGE_MIME,
  buildPresenterImagePath,
  presenterImageSignedUrl,
  setPresenterImagePath,
  uploadPresenterImage,
  type PresenterImageKind,
} from "@/lib/icfo-events/presenter-images";

export const dynamic = "force-dynamic";

function kindOf(req: NextRequest): PresenterImageKind | null {
  const k = req.nextUrl.searchParams.get("kind");
  return k === "headshot" || k === "logo" ? k : null;
}

type Ctx = { params: Promise<{ id: string; presenterId: string }> };

/** Signed preview URLs for the presenter's headshot and company logo (staff). */
export async function GET(_req: NextRequest, { params }: Ctx): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { presenterId } = await params;
    const { data, error } = await (auth.supabase as unknown as SupabaseClient)
      .from("event_presenters")
      .select("headshot_path, company_logo_path")
      .eq("id", presenterId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Presenter not found." }, { status: 404 });
    const row = data as { headshot_path: string | null; company_logo_path: string | null };
    const [headshotUrl, logoUrl] = await Promise.all([
      presenterImageSignedUrl(row.headshot_path),
      presenterImageSignedUrl(row.company_logo_path),
    ]);
    return NextResponse.json({ headshotUrl, logoUrl });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load images." }, { status: 500 });
  }
}

/** Upload a headshot or company logo (staff). Query: ?kind=headshot|logo. Multipart form: file. */
export async function POST(req: NextRequest, { params }: Ctx): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = kindOf(req);
  if (!kind) return NextResponse.json({ error: "kind must be headshot or logo." }, { status: 400 });
  try {
    const { presenterId } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    if (!PRESENTER_IMAGE_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported format. Use PNG or JPG." }, { status: 415 });
    }
    if (file.size > PRESENTER_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: "Image exceeds the 5 MB limit." }, { status: 413 });
    }
    const path = buildPresenterImagePath(presenterId, kind, file.name);
    await uploadPresenterImage(auth.supabase, path, Buffer.from(await file.arrayBuffer()), file.type);
    await setPresenterImagePath(auth.supabase, presenterId, kind, path);
    const url = await presenterImageSignedUrl(path);
    return NextResponse.json({ kind, path, url }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to upload image." }, { status: 500 });
  }
}

/** Clear the headshot or company logo (staff). The stored file is kept. */
export async function DELETE(req: NextRequest, { params }: Ctx): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = kindOf(req);
  if (!kind) return NextResponse.json({ error: "kind must be headshot or logo." }, { status: 400 });
  try {
    const { presenterId } = await params;
    await setPresenterImagePath(auth.supabase, presenterId, kind, null);
    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to remove image." }, { status: 500 });
  }
}
