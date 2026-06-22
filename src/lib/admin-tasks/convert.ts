// PPTX/DOCX → PDF conversion behind a single swappable interface (§7). Default
// provider mirrors the e-sign module: CloudConvert v2 Jobs API via raw fetch.
// Swap `converter` to LibreOffice/Gotenberg without touching callers.

import { getCloudConvertApiKey } from "@/lib/env";
import type { SourceFormat } from "./types";

const CLOUDCONVERT_API = "https://api.cloudconvert.com/v2";
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

export class TaskConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskConversionError";
  }
}

export interface PdfConverter {
  toPdf(input: { bytes: Buffer; sourceFormat: Extract<SourceFormat, "pptx" | "docx">; fileName: string }): Promise<Buffer>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Default converter: CloudConvert. Throws TaskConversionError on any failure. */
export const converter: PdfConverter = {
  async toPdf({ bytes, sourceFormat, fileName }) {
    const apiKey = getCloudConvertApiKey();
    if (!apiKey) {
      throw new TaskConversionError(
        "PDF conversion is not configured. The original file was saved; ask an admin to set CLOUDCONVERT_API_KEY for inline preview.",
      );
    }

    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

    const createRes = await fetch(`${CLOUDCONVERT_API}/jobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tasks: {
          "import-file": { operation: "import/base64", file: bytes.toString("base64"), filename: fileName },
          "convert-pdf": { operation: "convert", input: "import-file", input_format: sourceFormat, output_format: "pdf" },
          "export-pdf": { operation: "export/url", input: "convert-pdf", inline: false },
        },
      }),
    });
    if (!createRes.ok) throw new TaskConversionError(`Conversion service rejected the request (${createRes.status}).`);

    const jobId = (await createRes.json())?.data?.id as string | undefined;
    if (!jobId) throw new TaskConversionError("Conversion service did not return a job id.");

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let fileUrl: string | null = null;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const statusRes = await fetch(`${CLOUDCONVERT_API}/jobs/${jobId}?include=tasks`, { headers });
      if (!statusRes.ok) continue;
      const job = (await statusRes.json())?.data;
      if (job?.status === "error") throw new TaskConversionError("Conversion failed. Please check the file and try again.");
      if (job?.status === "finished") {
        const exportTask = (job.tasks ?? []).find(
          (t: { name?: string; operation?: string }) => t.name === "export-pdf" || t.operation === "export/url",
        );
        fileUrl = exportTask?.result?.files?.[0]?.url ?? null;
        break;
      }
    }
    if (!fileUrl) throw new TaskConversionError("Conversion timed out. Please try again or upload a PDF.");

    const pdfRes = await fetch(fileUrl);
    if (!pdfRes.ok) throw new TaskConversionError("Could not download the converted PDF.");
    return Buffer.from(await pdfRes.arrayBuffer());
  },
};
