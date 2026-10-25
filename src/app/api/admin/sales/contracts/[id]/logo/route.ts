import { NextResponse } from "next/server";
import { bad } from "@/lib/contracts/access";
import { LOGO_MAX_BYTES, logoPath, readLogoImage } from "@/lib/contracts/logo";
import { actorAndBundle, errorMessage } from "@/lib/contracts/route-helpers";
import { addEvent, getFile, putFile } from "@/lib/contracts/store";
import { CONTRACTS_BUCKET } from "@/lib/contracts/types";

export const dynamic = "force-dynamic";

/** The issuer logo is only for the Memorandum's Information Statement cover, while it is a draft. */
async function guard(id: string) {
  const r = await actorAndBundle(id);
  if ("error" in r) return r;
  if (r.b.template.key !== "sub_ppm") return { error: bad("Only the Private Placement Memorandum carries an issuer logo.") };
  return r;
}

/** GET: the uploaded logo, or 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await guard(id);
  if ("error" in r) return r.error;
  try {
    const bytes = await getFile(r.actor.db, logoPath(r.b.doc));
    const info = readLogoImage(bytes);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": info?.mime ?? "application/octet-stream", "Cache-Control": "private, no-store" } });
  } catch {
    return new Response(null, { status: 404 });
  }
}

/** POST: upload the logo (PNG or JPEG, up to 1 MB). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await guard(id);
  if ("error" in r) return r.error;
  if (r.b.doc.locked) return bad("This document was sent. Edit into a new version to change the logo.", 409);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return bad("Choose a PNG or JPEG file.");
  if (file.size > LOGO_MAX_BYTES) return bad("The logo must be 1 MB or smaller.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const info = readLogoImage(bytes);
  if (!info) return bad("The logo must be a PNG or JPEG picture.");
  try {
    await putFile(r.actor.db, logoPath(r.b.doc), bytes, info.mime);
    await addEvent(r.actor.db, r.b.doc.id, "logo_uploaded", r.actor.actorLabel, { bytes: bytes.length, width: info.width, height: info.height });
    return NextResponse.json({ ok: true, width: info.width, height: info.height });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Could not store the logo.") }, { status: 500 });
  }
}

/** DELETE: remove the logo; the cover then has no logo. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const r = await guard(id);
  if ("error" in r) return r.error;
  if (r.b.doc.locked) return bad("This document was sent. Edit into a new version to change the logo.", 409);
  await r.actor.db.storage.from(CONTRACTS_BUCKET).remove([logoPath(r.b.doc)]);
  await addEvent(r.actor.db, r.b.doc.id, "logo_removed", r.actor.actorLabel);
  return NextResponse.json({ ok: true });
}
