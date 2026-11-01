import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { extractDocumentText } from "@/lib/documents/extract-text";
import { countDocuments, finishDocument, insertDocument, removeDocument, TrainingError } from "@/lib/sales-ai/training-store";
import { MAX_DOCUMENTS } from "@/lib/sales-ai/training-types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { PDF_ONLY, validateFile } from "@/lib/uploads/policy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "sales-ai-training";

async function staff() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { profile: auth.profile };
}

// POST: add a PDF. Private storage, text pulled out right away and kept on the row. PDF only.
export async function POST(req: Request): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "No file provided." }, { status: 400 });
  const check = validateFile({ name: file.name, type: file.type, size: file.size }, PDF_ONLY);
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });
  const purposeRaw = form.get("purpose");
  const purpose = typeof purposeRaw === "string" && purposeRaw.trim() ? purposeRaw.trim().slice(0, 80) : null;

  try {
    if ((await countDocuments()) >= MAX_DOCUMENTS) return NextResponse.json({ error: `Up to ${MAX_DOCUMENTS} documents. Remove one first.` }, { status: 400 });
    const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
    const path = `${crypto.randomUUID()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const admin = createServiceRoleClient();
    await admin.storage.createBucket(BUCKET, { public: false, allowedMimeTypes: ["application/pdf"] }).catch(() => {});
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const row = await insertDocument({ fileName: file.name.slice(-120), storagePath: path, bytes: file.size, purpose, userId: a.profile.id });
    const text = await extractDocumentText(bytes, "application/pdf", file.name);
    const status = await finishDocument(row.id, text);
    return NextResponse.json({
      document: { ...row, status },
      message: status === "trained" ? "Trained. New drafts can use this document now." : "No readable text found. Scanned PDFs need a text layer.",
    });
  } catch (err) {
    if (err instanceof TrainingError) return NextResponse.json({ error: err.message }, { status: 500 });
    return NextResponse.json({ error: "Could not add the document." }, { status: 500 });
  }
}

// DELETE: remove a document and its file.
export async function DELETE(req: Request): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const path = await removeDocument(id);
  if (!path) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await createServiceRoleClient().storage.from(BUCKET).remove([path]).catch(() => {});
  return NextResponse.json({ ok: true });
}
