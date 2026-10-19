import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any -- email_images is not in the generated types yet */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = "id, name, storage_path, public_url, mime_type, bytes, width, height, alt_text, created_at";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH { name?, altText? }: renames an image or changes its default alt text. The link never changes. */
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid image id." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { name?: unknown; altText?: unknown } | null;
  const patch: Record<string, string | null> = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "The name cannot be empty." }, { status: 400 });
    patch.name = name;
  }
  if (typeof body?.altText === "string") patch.alt_text = body.altText.trim().slice(0, 200) || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const db = auth.supabase as any;
  const { data, error } = await db.from("email_images").update(patch).eq("id", id).is("archived_at", null).select(COLUMNS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  return NextResponse.json({ image: data });
}

/**
 * DELETE: archives the image. It leaves the picker and the library, but the file stays
 * in storage so emails that were already sent keep showing it.
 */
export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid image id." }, { status: 400 });

  const db = auth.supabase as any;
  const { error } = await db.from("email_images").update({ archived_at: new Date().toISOString() }).eq("id", id).is("archived_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
