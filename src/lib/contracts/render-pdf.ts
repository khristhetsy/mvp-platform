// One render engine for every PDF the contract feature produces: the editor's
// true preview, the PDF download, the e-signature copy and (through sealing)
// the executed copy all come from this converter, so they cannot differ.
//
// CloudConvert with the Microsoft Office engine, so Word layout (fonts,
// numbering, tables, page breaks) renders as Word renders it. The engine is
// configurable with CLOUDCONVERT_DOCX_ENGINE for a plan without Office.

import { getCloudConvertApiKey } from "@/lib/env";

const API = "https://api.cloudconvert.com/v2";
const POLL_MS = 1200;
const TIMEOUT_MS = 90_000;

export class RenderUnavailableError extends Error {
  constructor() {
    super("PDF rendering is not configured. Add CLOUDCONVERT_API_KEY in Vercel to enable Preview, PDF and Send.");
    this.name = "RenderUnavailableError";
  }
}

export class RenderFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderFailedError";
  }
}

export function renderConfigured(): boolean {
  return Boolean(getCloudConvertApiKey());
}

function engine(): string {
  return process.env.CLOUDCONVERT_DOCX_ENGINE?.trim() || "office";
}

export async function docxToPdf(docx: Buffer, filename: string): Promise<Buffer> {
  const apiKey = getCloudConvertApiKey();
  if (!apiKey) throw new RenderUnavailableError();
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const create = await fetch(`${API}/jobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tasks: {
        "import-docx": { operation: "import/base64", file: docx.toString("base64"), filename },
        "convert-pdf": { operation: "convert", input: "import-docx", input_format: "docx", output_format: "pdf", engine: engine() },
        "export-pdf": { operation: "export/url", input: "convert-pdf", inline: false },
      },
    }),
  });
  if (!create.ok) throw new RenderFailedError(`The PDF service rejected the request (${create.status}).`);
  const jobId = (await create.json())?.data?.id as string | undefined;
  if (!jobId) throw new RenderFailedError("The PDF service did not return a job id.");

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const res = await fetch(`${API}/jobs/${jobId}?include=tasks`, { headers });
    if (!res.ok) continue;
    const job = (await res.json())?.data;
    if (job?.status === "error") {
      const failed = (job.tasks ?? []).find((t: { status?: string }) => t.status === "error") as { message?: string } | undefined;
      throw new RenderFailedError(`PDF rendering failed${failed?.message ? `: ${failed.message}` : "."}`);
    }
    if (job?.status === "finished") {
      const exp = (job.tasks ?? []).find((t: { name?: string }) => t.name === "export-pdf");
      const url = exp?.result?.files?.[0]?.url as string | undefined;
      if (!url) throw new RenderFailedError("The PDF service returned no file.");
      const pdf = await fetch(url);
      if (!pdf.ok) throw new RenderFailedError("Could not download the rendered PDF.");
      return Buffer.from(await pdf.arrayBuffer());
    }
  }
  throw new RenderFailedError("PDF rendering timed out. Please try again.");
}
