import { NextResponse, type NextRequest } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { buildBannerPath, uploadEventBanner, bannerPublicUrl, setEventLobbyBackground } from "@/lib/icfo-events/banner";

export const dynamic = "force-dynamic";

const MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

// POST — upload an immersive lobby background image for the event.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    if (!MIME.includes(file.type)) return NextResponse.json({ error: "Use a PNG, JPG, or WEBP image." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be 8 MB or smaller." }, { status: 400 });

    const path = buildBannerPath(id, `lobby-${file.name}`);
    await uploadEventBanner(auth.supabase, path, Buffer.from(await file.arrayBuffer()), file.type);
    await setEventLobbyBackground(auth.supabase, id, path);
    return NextResponse.json({ path, url: bannerPublicUrl(auth.supabase, path) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to upload lobby background." }, { status: 500 });
  }
}

// DELETE — clear the lobby background (revert to the default grid lobby).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    await setEventLobbyBackground(auth.supabase, id, null);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to clear lobby background." }, { status: 500 });
  }
}
