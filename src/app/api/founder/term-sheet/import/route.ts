import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { extractDocumentText } from "@/lib/documents/extract-text";
import { docxText } from "@/lib/term-sheet/fill";
import { detectFormType, extractValues } from "@/lib/term-sheet/extract";
import { gateTermSheetApi } from "@/lib/term-sheet/gate";
import { parseFormType } from "@/lib/term-sheet/values";

export const dynamic = "force-dynamic";
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Read an uploaded term sheet (text based PDF or Word) and return the values it finds for the template's
 * blanks. Nothing is saved here: the founder reviews the values in the creator first.
 */
export async function POST(request: Request): Promise<Response> {
  const g = await gateTermSheetApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to read." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is too large to read." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isDocx = /\.docx$/i.test(file.name) || file.type.includes("wordprocessingml");
    const text = isDocx ? await docxText(Buffer.from(bytes)) : await extractDocumentText(bytes, file.type || null, file.name);
    if (!text.trim()) {
      return NextResponse.json({ error: "This file has no readable text. Upload a text based PDF or a Word file." }, { status: 422 });
    }
    const requested = parseFormType(form.get("formType"));
    const detected = detectFormType(text);
    const formType = requested ?? detected;
    if (!formType) return NextResponse.json({ error: "We could not tell which template this term sheet follows. Choose one and try again." }, { status: 422 });
    const values = extractValues(formType, text);
    return NextResponse.json({ formType, detected, values, found: Object.keys(values).length });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to read the file." }, { status: 500 });
  }
}
