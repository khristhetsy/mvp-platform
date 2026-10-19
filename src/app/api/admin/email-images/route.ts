import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import {
  EMAIL_IMAGE_BUCKET,
  EMAIL_IMAGE_MAX_BYTES,
  buildEmailImagePath,
  checkImageFile,
  formatImageSize,
  sniffImageType,
} from "@/lib/email-images";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* eslint-disable @typescript-eslint/no-explicit-any -- email_images is not in the generated types yet */

const COLUMNS = "id, name, storage_path, public_url, mime_type, bytes, width, height, alt_text, created_at";

/** GET: the library, newest first, archived images left out. Staff only. */
export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const db = auth.supabase as any;
  const { data, error } = await db
    .from("email_images")
    .select(COLUMNS)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ images: data ?? [] });
}

const dim = (v: FormDataEntryValue | null): number | null => {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 && n < 20000 ? n : null;
};

/** POST multipart (file, optional width, height, alt): stores one image under a new unique path. */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  const check = checkImageFile(file);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > EMAIL_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: `${file.name}: ${formatImageSize(bytes.length)} is over the ${formatImageSize(EMAIL_IMAGE_MAX_BYTES)} limit.` }, { status: 400 });
  }
  const real = sniffImageType(bytes);
  if (!real || real !== check.mime) {
    return NextResponse.json({ error: `${file.name}: the file content does not match its image type.` }, { status: 400 });
  }

  const db = auth.supabase as any;
  const path = buildEmailImagePath(file.name, real, crypto.randomUUID());
  const storage = db.storage.from(EMAIL_IMAGE_BUCKET);

  const { error: upErr } = await storage.upload(path, bytes, {
    contentType: real,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const publicUrl: string = storage.getPublicUrl(path).data.publicUrl;
  const altRaw = form.get("alt");
  const alt = typeof altRaw === "string" && altRaw.trim() ? altRaw.trim().slice(0, 200) : null;

  const { data, error } = await db
    .from("email_images")
    .insert({
      name: file.name.slice(0, 120),
      storage_path: path,
      public_url: publicUrl,
      mime_type: real,
      bytes: bytes.length,
      width: dim(form.get("width")),
      height: dim(form.get("height")),
      alt_text: alt,
      uploaded_by: auth.profile.id,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    // Do not leave a file behind that the library cannot show.
    await storage.remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ image: data });
}
