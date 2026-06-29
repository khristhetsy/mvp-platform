import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { buildBannerPath, uploadEventBanner, bannerPublicUrl, setEventCover } from "@/lib/icfo-events/banner";

export const dynamic = "force-dynamic";

const MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

/** Upload a banner image (staff). Multipart form: file. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    if (!MIME.includes(file.type)) return NextResponse.json({ error: "Use PNG, JPG, or WebP." }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image exceeds the 5 MB limit." }, { status: 413 });

    const path = buildBannerPath(id, file.name);
    await uploadEventBanner(auth.supabase, path, Buffer.from(await file.arrayBuffer()), file.type);
    await setEventCover(auth.supabase, id, { coverPath: path });
    return NextResponse.json({ coverPath: path, coverUrl: bannerPublicUrl(auth.supabase, path) }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to upload banner." }, { status: 500 });
  }
}

const patchSchema = z.object({
  overlay: z.number().int().min(0).max(90).optional(),
  focal: z.string().max(20).optional(),
});

/** Update overlay darkness / focal point (staff). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    await setEventCover(auth.supabase, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to update banner." }, { status: 500 });
  }
}

/** Remove the banner (staff). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    await setEventCover(auth.supabase, id, { coverPath: null });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to remove banner." }, { status: 500 });
  }
}
