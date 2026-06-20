import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** POST a file (multipart) → stored in the private bucket → returns metadata. */
export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)." }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
  const path = `${auth.profile.id}/${randomBytes(8).toString("hex")}-${safeName}`;
  const admin = createServiceRoleClient();
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from("email-attachments")
    .upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) {
    return NextResponse.json({ error: error.message ?? "Upload failed." }, { status: 500 });
  }

  return NextResponse.json({
    attachment: { name: safeName, path, size: file.size, content_type: file.type || null },
  });
}
