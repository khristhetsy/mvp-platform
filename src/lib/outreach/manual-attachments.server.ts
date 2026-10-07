// Server-only: turn a campaign's attachment choices into Resend attachments.
// Built once per campaign per send pass and reused for every recipient.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStorageBucket, PITCH_DECKS_BUCKET } from "@/lib/data/documents";
import { loadOnePagerCompany, onePagerFileName, renderOnePagerPdf } from "@/lib/outreach/one-pager-pdf";
import { MAX_ATTACHMENT_BYTES, type ManualAttachments } from "@/lib/outreach/manual-attachments";

export type BuiltAttachment = { filename: string; content: string };

export type BuiltAttachments = {
  attachments: BuiltAttachment[];
  /** Names of chosen files that were left off (too large, missing, not a PDF). */
  skipped: string[];
};

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
}

async function download(db: SupabaseClient, documentType: string | null, path: string): Promise<Uint8Array | null> {
  // Current uploads live in the canonical bucket; early pitch decks in the legacy one.
  for (const bucket of [getStorageBucket(documentType ?? ""), PITCH_DECKS_BUCKET]) {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (!error && data) return new Uint8Array(await data.arrayBuffer());
  }
  return null;
}

export async function buildManualAttachments(
  db: SupabaseClient,
  companyId: string,
  att: ManualAttachments,
): Promise<BuiltAttachments> {
  const out: BuiltAttachment[] = [];
  const skipped: string[] = [];
  let total = 0;

  if (att.onePagerPdf) {
    const company = await loadOnePagerCompany(db, companyId);
    if (company) {
      const onlineUrl = company.is_published && company.slug ? `${appBase()}/f/${company.slug}` : null;
      const pdf = await renderOnePagerPdf(company, { onlineUrl });
      total += pdf.length;
      out.push({ filename: onePagerFileName(company.company_name), content: pdf.toString("base64") });
    } else {
      skipped.push("One pager");
    }
  }

  if (att.documentIds.length > 0) {
    const { data } = await db
      .from("documents")
      .select("id, company_id, document_type, file_name, file_path, mime_type, size_bytes")
      .eq("company_id", companyId)
      .in("id", att.documentIds);
    const docs = (data ?? []) as Array<{
      id: string;
      document_type: string | null;
      file_name: string | null;
      file_path: string | null;
      mime_type: string | null;
      size_bytes: number | null;
    }>;
    for (const d of docs) {
      const name = d.file_name || "document.pdf";
      const isPdf = (d.mime_type ?? "").includes("pdf") || name.toLowerCase().endsWith(".pdf");
      if (!d.file_path || !isPdf) {
        skipped.push(name);
        continue;
      }
      if (d.size_bytes && total + d.size_bytes > MAX_ATTACHMENT_BYTES) {
        skipped.push(name);
        continue;
      }
      const bytes = await download(db, d.document_type, d.file_path);
      if (!bytes || total + bytes.length > MAX_ATTACHMENT_BYTES) {
        skipped.push(name);
        continue;
      }
      total += bytes.length;
      out.push({ filename: name, content: Buffer.from(bytes).toString("base64") });
    }
  }

  return { attachments: out, skipped };
}
