import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

const BUCKET = "company-logos";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { profile } = auth;

  const { id: companyId } = await params;

  // Verify ownership via company_members or founder_id
  const admin = createServiceRoleClient();
  const { data: membership } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!membership) {
    const { data: legacy } = await admin
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .eq("founder_id", profile.id)
      .maybeSingle();
    if (!legacy) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be PNG, JPG, WebP, or SVG." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 2 MB." }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${companyId}/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Ensure bucket exists (idempotent)
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Also patch the company row
  await admin.from("companies").update({ logo_url: logoUrl }).eq("id", companyId);

  return NextResponse.json({ logo_url: logoUrl });
}
