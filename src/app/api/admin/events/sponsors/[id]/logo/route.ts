import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requirePermissionApi } from "@/lib/api/permissions";
import {
  buildSponsorLogoPath,
  uploadSponsorLogo,
  setSponsorLogoPath,
  sponsorLogoSignedUrl,
} from "@/lib/icfo-events/sponsors";

export const dynamic = "force-dynamic";

const LOGO_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Upload a logo for a sponsor (staff). Multipart form: file. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!LOGO_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported format. Use PNG, JPG, WebP, or SVG." }, { status: 415 });
    }
    if (file.size > LOGO_MAX_BYTES) {
      return NextResponse.json({ error: "Logo exceeds the 5 MB limit." }, { status: 413 });
    }

    const path = buildSponsorLogoPath(id, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadSponsorLogo(auth.supabase, path, bytes, file.type);
    const sponsor = await setSponsorLogoPath(auth.supabase, id, path);
    const logoUrl = await sponsorLogoSignedUrl(path);

    return NextResponse.json({ sponsor, logoUrl }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to upload logo." }, { status: 500 });
  }
}
