import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

// Verify the bytes are actually a raster image (magic numbers), not just a
// file with an image content-type set by the client.
function looksLikeImage(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return jpg || png || gif || webp;
}

// GET /api/profile/avatar — the current user's avatar URL (for the header).
export async function GET() {
  const auth = await requireApiProfile(["founder", "investor", "admin", "analyst"]);
  if ("error" in auth) return auth.error;
  const admin = createServiceRoleClient();
  const { data } = await admin.from("profiles").select("avatar_url").eq("id", auth.profile.id).maybeSingle();
  const avatarUrl = (data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
  return NextResponse.json({ avatarUrl });
}

// POST /api/profile/avatar — upload a profile photo. Uses the service role to
// store in the `avatars` bucket, so no storage RLS policies are needed.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder", "investor", "admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (!ALLOWED.includes(file.type as (typeof ALLOWED)[number])) {
    return NextResponse.json({ error: "Use a JPG, PNG, WEBP, or GIF image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be 3 MB or smaller." }, { status: 400 });

  const admin = createServiceRoleClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const path = `${auth.profile.id}/avatar.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeImage(bytes)) {
    return NextResponse.json({ error: "That file isn't a valid image." }, { status: 400 });
  }

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 400 });
  }

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  // Cache-bust so a re-upload shows immediately instead of the cached image.
  const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_url: avatarUrl } as never)
    .eq("id", auth.profile.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ avatarUrl });
}
