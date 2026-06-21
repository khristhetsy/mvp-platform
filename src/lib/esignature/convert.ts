// DOCX → PDF conversion, isolated behind a single function so the provider can
// be swapped without touching callers. Current provider: CloudConvert (v2 Jobs
// API via raw fetch, matching the repo's external-API convention).
//
// Always sign against the converted PDF — never the original .docx.

import { getCloudConvertApiKey } from "@/lib/env";

const CLOUDCONVERT_API = "https://api.cloudconvert.com/v2";
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

class DocxConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocxConversionError";
  }
}

/**
 * Convert a .docx buffer to a PDF buffer. Throws DocxConversionError on any
 * failure (missing key, provider error, timeout) with a user-safe message.
 */
export async function convertDocxToPdf(docx: Buffer, filename = "document.docx"): Promise<Buffer> {
  const apiKey = getCloudConvertApiKey();
  if (!apiKey) {
    throw new DocxConversionError(
      "Word (.docx) conversion is not configured. Upload a PDF, or ask an admin to set CLOUDCONVERT_API_KEY.",
    );
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // 1. Create a job: import the docx (base64), convert to pdf, export a URL.
  const createRes = await fetch(`${CLOUDCONVERT_API}/jobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tasks: {
        "import-docx": {
          operation: "import/base64",
          file: docx.toString("base64"),
          filename,
        },
        "convert-pdf": {
          operation: "convert",
          input: "import-docx",
          input_format: "docx",
          output_format: "pdf",
        },
        "export-pdf": {
          operation: "export/url",
          input: "convert-pdf",
          inline: false,
        },
      },
    }),
  });

  if (!createRes.ok) {
    throw new DocxConversionError(`Conversion service rejected the request (${createRes.status}).`);
  }

  const jobId = (await createRes.json())?.data?.id as string | undefined;
  if (!jobId) throw new DocxConversionError("Conversion service did not return a job id.");

  // 2. Poll until the job finishes (or errors / times out).
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let fileUrl: string | null = null;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await fetch(`${CLOUDCONVERT_API}/jobs/${jobId}?include=tasks`, { headers });
    if (!statusRes.ok) continue;

    const job = (await statusRes.json())?.data;
    if (job?.status === "error") {
      throw new DocxConversionError("Conversion failed. Please check the document and try again.");
    }
    if (job?.status === "finished") {
      const exportTask = (job.tasks ?? []).find(
        (t: { name?: string; operation?: string }) => t.name === "export-pdf" || t.operation === "export/url",
      );
      fileUrl = exportTask?.result?.files?.[0]?.url ?? null;
      break;
    }
  }

  if (!fileUrl) {
    throw new DocxConversionError("Conversion timed out. Please try again or upload a PDF.");
  }

  // 3. Download the produced PDF.
  const pdfRes = await fetch(fileUrl);
  if (!pdfRes.ok) throw new DocxConversionError("Could not download the converted PDF.");

  return Buffer.from(await pdfRes.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { DocxConversionError };
