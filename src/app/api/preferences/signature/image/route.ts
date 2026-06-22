import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "email-signature-assets";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** POST — upload a signature image to the public bucket; returns a stable public URL. */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image too large (max 2 MB)." }, { status: 400 });
  if (!ACCEPTED.has(file.type)) return NextResponse.json({ error: "Use a PNG, JPG, GIF, or WEBP image." }, { status: 400 });

  const ext = EXT[file.type];
  const path = `${auth.profile.id}/${randomBytes(8).toString("hex")}.${ext}`;
  const admin = createServiceRoleClient();
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message ?? "Upload failed." }, { status: 500 });

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
