// Generate documents.ai_summary for an uploaded file: download → extract text →
// summarize with Claude → store. The Capital Readiness engine keyword-matches
// this summary, so the prompt preserves concrete evidence terms verbatim.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStorageBucket } from "@/lib/data/documents";
import { extractDocumentText } from "@/lib/documents/extract-text";
import { claudeComplete, CLAUDE_HAIKU, isClaudeConfigured } from "@/lib/claude";

export type SummarizeResult = { status: "ok" | "skipped"; reason?: string };

const SYSTEM = [
  "You summarize a startup's due-diligence document for an investment-readiness engine.",
  "Write a factual, plain-text summary of at most 180 words. No preamble, no markdown.",
  "Preserve concrete evidence VERBATIM where present: customer names, LOIs / letters of intent,",
  "pilots, contracts, revenue and growth metrics (ARR, MRR, retention, churn, users), patents,",
  "trademarks, proprietary technology, competitive moat, exit strategy, acquirers, IPO,",
  "comparables, return multiples (IRR, 5x, 10x), burn rate, runway, team credentials, and market size.",
  "If the document lacks a category, do not invent it — only report what is actually present.",
].join(" ");

async function loadDoc(admin: SupabaseClient<Database>, documentId: string) {
  const { data } = await admin
    .from("documents")
    .select("id, company_id, document_type, file_name, file_path, mime_type, ai_summary")
    .eq("id", documentId)
    .maybeSingle();
  return data as
    | {
        id: string;
        company_id: string | null;
        document_type: string | null;
        file_name: string | null;
        file_path: string | null;
        mime_type: string | null;
        ai_summary: string | null;
      }
    | null;
}

export async function summarizeDocumentById(
  admin: SupabaseClient<Database>,
  documentId: string,
  opts: { force?: boolean } = {},
): Promise<SummarizeResult> {
  if (!isClaudeConfigured()) return { status: "skipped", reason: "no_api_key" };

  const doc = await loadDoc(admin, documentId);
  if (!doc) return { status: "skipped", reason: "not_found" };
  if (!opts.force && doc.ai_summary && doc.ai_summary.trim().length > 0) {
    return { status: "skipped", reason: "already_summarized" };
  }
  if (!doc.file_path) return { status: "skipped", reason: "no_file_path" };

  const bucket = getStorageBucket(doc.document_type ?? "");
  const { data: blob, error } = await admin.storage.from(bucket).download(doc.file_path);
  if (error || !blob) return { status: "skipped", reason: "download_failed" };

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = await extractDocumentText(bytes, doc.mime_type, doc.file_name ?? "");
  if (!text || text.trim().length < 40) return { status: "skipped", reason: "no_text" };

  let summary: string;
  try {
    summary = await claudeComplete(
      [
        {
          role: "user",
          content: `Document type: ${doc.document_type ?? "unknown"}\nFile: ${doc.file_name ?? ""}\n\n---\n${text}\n---\n\nSummarize per the instructions.`,
        },
      ],
      { model: CLAUDE_HAIKU, maxTokens: 500, system: SYSTEM },
    );
  } catch {
    return { status: "skipped", reason: "ai_failed" };
  }

  const clean = (summary ?? "").trim();
  if (!clean) return { status: "skipped", reason: "empty_summary" };

  const { error: upErr } = await admin
    .from("documents")
    .update({ ai_summary: clean } as never)
    .eq("id", documentId);
  if (upErr) return { status: "skipped", reason: "save_failed" };

  return { status: "ok" };
}

/**
 * Analyze every un-summarized document for one company: extract text and store
 * an ai_summary for each, so downstream consumers (diligence report, readiness
 * engine) have real content to work from. Bounded and best-effort — a document
 * that can't be summarized (scanned PDF, download failure) is simply skipped.
 */
export async function ensureCompanyDocumentSummaries(
  admin: SupabaseClient<Database>,
  companyId: string,
  opts: { max?: number } = {},
): Promise<{ summarized: number; attempted: number }> {
  if (!isClaudeConfigured()) return { summarized: 0, attempted: 0 };
  const pending = await listDocumentsNeedingSummary(admin, { companyId, limit: opts.max ?? 12 });
  let summarized = 0;
  for (const doc of pending) {
    const res = await summarizeDocumentById(admin, doc.id).catch(() => null);
    if (res?.status === "ok") summarized += 1;
  }
  return { summarized, attempted: pending.length };
}

/** Documents (optionally for one company) that still need a summary. */
export async function listDocumentsNeedingSummary(
  admin: SupabaseClient<Database>,
  opts: { companyId?: string; limit?: number } = {},
): Promise<Array<{ id: string; company_id: string | null }>> {
  let q = admin
    .from("documents")
    .select("id, company_id, ai_summary, file_path")
    .is("ai_summary", null)
    .not("file_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 15);
  if (opts.companyId) q = q.eq("company_id", opts.companyId);
  const { data } = await q;
  return ((data ?? []) as Array<{ id: string; company_id: string | null }>).map((d) => ({
    id: d.id,
    company_id: d.company_id,
  }));
}
