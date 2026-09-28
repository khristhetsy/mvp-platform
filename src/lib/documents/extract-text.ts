// Extract plain text from an uploaded document's bytes, for AI summarization.
// Supports PDF (pdfjs-dist), Word .docx (mammoth), and XLSX/CSV/plain text.
// Returns "" when the type isn't extractable — callers should skip summarizing
// rather than fabricate.

const MAX_CHARS = 16000;
const MAX_PDF_PAGES = 25;

function isPdf(mime: string, name: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}
function isXlsx(mime: string, name: string) {
  return (
    mime.includes("spreadsheetml") ||
    mime === "application/vnd.ms-excel" ||
    /\.(xlsx|xls)$/i.test(name)
  );
}
function isDocx(mime: string, name: string) {
  return mime.includes("wordprocessingml") || /\.docx$/i.test(name);
}
function isCsvOrText(mime: string, name: string) {
  return mime.startsWith("text/") || /\.(csv|tsv|txt|md)$/i.test(name);
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value ?? "";
}

let pdfWorkerReady: Promise<void> | null = null;

/**
 * pdfjs in Node runs a "fake worker" on the main thread, and it finds that
 * worker by importing ./pdf.worker.mjs from disk at runtime. Vercel's file
 * tracing cannot see that dynamic path, so the file was missing in production
 * and every PDF failed with "Setting up fake worker failed". The error was
 * swallowed, the text came back empty, and no PDF ever got an ai_summary.
 *
 * Importing the worker here makes it a static dependency, and putting it on
 * globalThis.pdfjsWorker hands pdfjs the handler directly so it never looks
 * for the file.
 */
async function ensurePdfWorker(): Promise<void> {
  const g = globalThis as { pdfjsWorker?: unknown };
  if (g.pdfjsWorker) return;
  pdfWorkerReady ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs").then((m) => {
    g.pdfjsWorker = m;
  });
  await pdfWorkerReady;
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  // Dynamic import of the legacy (main-thread) build — no worker thread in Node.
  await ensurePdfWorker();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
  const chunks: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => (typeof (it as { str?: unknown }).str === "string" ? (it as { str: string }).str : ""))
      .join(" ");
    chunks.push(line);
    if (chunks.join(" ").length > MAX_CHARS) break;
  }
  try {
    await doc.destroy();
  } catch {
    /* ignore */
  }
  return chunks.join("\n");
}

async function extractXlsx(bytes: Uint8Array): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const out: string[] = [];
  wb.eachSheet((sheet) => {
    out.push(`# ${sheet.name}`);
    sheet.eachRow((row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object" && "text" in (v as Record<string, unknown>)) return String((v as { text: unknown }).text);
        if (typeof v === "object" && "result" in (v as Record<string, unknown>)) return String((v as { result: unknown }).result);
        return String(v);
      });
      const line = vals.filter(Boolean).join("\t");
      if (line.trim()) out.push(line);
    });
    if (out.join("\n").length > MAX_CHARS) return;
  });
  return out.join("\n");
}

export async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: string | null,
  fileName: string,
): Promise<string> {
  const mime = mimeType ?? "";
  try {
    let text = "";
    if (isPdf(mime, fileName)) text = await extractPdf(bytes);
    else if (isDocx(mime, fileName)) text = await extractDocx(bytes);
    else if (isXlsx(mime, fileName)) text = await extractXlsx(bytes);
    else if (isCsvOrText(mime, fileName)) text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    else return "";
    return text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, MAX_CHARS);
  } catch (err) {
    // Still return "" so callers skip rather than fabricate, but say why. A
    // silent catch here hid a production-wide PDF failure for months.
    console.error("[extract-text] extraction failed", { fileName, mime, err: String(err) });
    return "";
  }
}
