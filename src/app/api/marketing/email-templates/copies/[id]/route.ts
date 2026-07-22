import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { updateCopy, type CopyUpdate } from "@/lib/email/masters-queries";

// Save a template copy (build spec §5). Only slot values, banner choice, footer
// note, name, and status are writable — the master and its locked brand layer
// are never touched here.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as CopyUpdate | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    // Whitelist writable fields — never accept master_id or arbitrary columns.
    const patch: CopyUpdate = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (body.slot_values && typeof body.slot_values === "object") patch.slot_values = body.slot_values;
    if (body.banner_mode === "gradient" || body.banner_mode === "image") patch.banner_mode = body.banner_mode;
    if (typeof body.banner_image_url === "string" || body.banner_image_url === null) {
      patch.banner_image_url = body.banner_image_url;
    }
    if (typeof body.footer_note === "string" || body.footer_note === null) patch.footer_note = body.footer_note;
    if (body.status === "draft" || body.status === "ready" || body.status === "archived") patch.status = body.status;

    const copy = await updateCopy(id, patch);
    return NextResponse.json({ copy });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to save.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
