// Seal a signed envelope: burn field values + signature image into the working
// PDF, hash it (SHA-256, the tamper-evidence anchor), store the sealed file, and
// mark the envelope completed.

import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { STORAGE_BUCKET, STORAGE_FOLDER_SIGNED, MIME_PDF, BRAND } from "./types";
import type { SignatureField, SignatureRequest } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type SealResult = { signedPath: string; hash: string };

export async function sealEnvelope(
  supabase: SupabaseClient<Database>,
  request: SignatureRequest,
  fields: SignatureField[],
): Promise<SealResult> {
  // 1. Download the working PDF.
  const dl = await supabase.storage.from(STORAGE_BUCKET).download(request.working_file_path);
  if (dl.error || !dl.data) throw new Error("Could not load the working PDF for sealing.");
  const workingBytes = new Uint8Array(await dl.data.arrayBuffer());

  // 2. Burn values in.
  const pdf = await PDFDocument.load(workingBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const f of fields) {
    const page = pages[f.page - 1];
    if (!page) continue;
    const pw = page.getWidth();
    const ph = page.getHeight();
    const boxW = f.width * pw;
    const boxH = f.height * ph;
    const left = f.x * pw;
    const topFromTop = f.y * ph;
    const bottom = ph - topFromTop - boxH; // pdf-lib origin is bottom-left

    if ((f.field_type === "signature" || f.field_type === "initial") && f.value?.startsWith("data:image")) {
      try {
        const png = await pdf.embedPng(dataUrlToBytes(f.value));
        const scale = Math.min(boxW / png.width, boxH / png.height);
        const w = png.width * scale;
        const h = png.height * scale;
        page.drawImage(png, { x: left + (boxW - w) / 2, y: bottom + (boxH - h) / 2, width: w, height: h });
      } catch {
        // Fall through — leave the box blank rather than failing the whole seal.
      }
      continue;
    }

    const text = (f.value ?? "").trim();
    if (!text) continue;
    const size = Math.max(8, Math.min(12, boxH * 0.55));
    page.drawText(text, {
      x: left + 2,
      y: bottom + (boxH - size) / 2 + 1,
      size,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
  }

  // 3. Footer stamp on every page.
  for (const page of pages) {
    page.drawText(BRAND.sealStamp, {
      x: 24,
      y: 14,
      size: 7,
      font,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  const sealedBytes = await pdf.save();

  // 4. Hash (tamper-evidence anchor).
  const hash = createHash("sha256").update(sealedBytes).digest("hex");

  // 5. Store the sealed PDF.
  const signedPath = `${STORAGE_FOLDER_SIGNED}/${request.id}.pdf`;
  const up = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(signedPath, sealedBytes, { contentType: MIME_PDF, upsert: true });
  if (up.error) throw new Error(`Could not store the sealed PDF: ${up.error.message}`);

  // 6. Complete the envelope.
  const { error } = await raw(supabase)
    .from("signature_requests")
    .update({ signed_file_path: signedPath, document_hash: hash, status: "completed" })
    .eq("id", request.id);
  if (error) throw new Error(`Could not finalize the envelope: ${error.message}`);

  return { signedPath, hash };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}
