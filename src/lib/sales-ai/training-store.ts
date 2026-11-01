/**
 * Data access for the sales AI training: settings, documents, examples.
 * Service role, staff routes only. Falls back to defaults if the tables cannot
 * be read, so drafting keeps working with the built-in text.
 */
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { draftViolations } from "./guards";
import { cleanList } from "./skip";
import {
  DEFAULT_REFUND_LINE, DEFAULT_SETTINGS, MAX_BLOCKED_WORDS, MAX_DOCUMENTS, MAX_EXAMPLES, MAX_SKIP_PHRASES, MAX_SKIP_TAGS,
  type TrainingDocument, type TrainingExample, type TrainingSettings,
} from "./training-types";

const db = () => serviceRoleClientUntyped();

export class TrainingError extends Error {}

/* ---------- settings ---------- */

type SettingsRow = { blocked_words: string[] | null; refund_line: string | null; skip_phrases: string[] | null; skip_tags: string[] | null };

export async function loadSettings(): Promise<TrainingSettings> {
  try {
    const { data } = await db().from("sales_ai_settings").select("blocked_words, refund_line, skip_phrases, skip_tags").eq("id", true).maybeSingle();
    const r = data as SettingsRow | null;
    if (!r) return DEFAULT_SETTINGS;
    return {
      blockedWords: r.blocked_words ?? [],
      refundLine: r.refund_line?.trim() || DEFAULT_REFUND_LINE,
      skipPhrases: r.skip_phrases ?? [],
      skipTags: r.skip_tags ?? [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Checks and cleans what a person typed. Throws a message safe to show. */
export function validateSettings(input: Partial<TrainingSettings>): TrainingSettings {
  const blockedWords = cleanList(input.blockedWords, MAX_BLOCKED_WORDS);
  const skipPhrases = cleanList(input.skipPhrases, MAX_SKIP_PHRASES);
  const skipTags = cleanList(input.skipTags, MAX_SKIP_TAGS, 40);
  const refundLine = (input.refundLine ?? "").replace(/\s+/g, " ").trim();
  if (refundLine.length < 10 || refundLine.length > 200) throw new TrainingError("The refund line must be between 10 and 200 characters.");
  const broken = draftViolations(refundLine, blockedWords);
  if (broken.length) throw new TrainingError(`The refund line breaks a copy rule (${broken.join(", ")}).`);
  return { blockedWords, refundLine, skipPhrases, skipTags };
}

export async function saveSettings(input: Partial<TrainingSettings>, userId: string): Promise<TrainingSettings> {
  const s = validateSettings(input);
  const { error } = await db().from("sales_ai_settings").upsert({
    id: true, blocked_words: s.blockedWords, refund_line: s.refundLine, skip_phrases: s.skipPhrases, skip_tags: s.skipTags,
    updated_by: userId, updated_at: new Date().toISOString(),
  });
  if (error) throw new TrainingError("Could not save the settings.");
  return s;
}

/* ---------- documents ---------- */

type DocRow = { id: string; file_name: string; purpose: string | null; status: TrainingDocument["status"]; bytes: number | null; created_at: string; extracted_text?: string | null };

const toDoc = (r: DocRow, withText: boolean): TrainingDocument => ({
  id: r.id, fileName: r.file_name, purpose: r.purpose, status: r.status, bytes: r.bytes, createdAt: r.created_at,
  ...(withText ? { text: r.extracted_text ?? null } : {}),
});

export async function listDocuments(withText = false): Promise<TrainingDocument[]> {
  try {
    const cols: string = withText ? "id, file_name, purpose, status, bytes, created_at, extracted_text" : "id, file_name, purpose, status, bytes, created_at";
    const { data } = await db().from("sales_ai_documents").select(cols).order("created_at", { ascending: false }).limit(MAX_DOCUMENTS + 5);
    return ((data ?? []) as unknown as DocRow[]).map((r) => toDoc(r, withText));
  } catch {
    return [];
  }
}

export async function countDocuments(): Promise<number> {
  const { count } = await db().from("sales_ai_documents").select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function insertDocument(row: { fileName: string; storagePath: string; bytes: number; purpose: string | null; userId: string }): Promise<TrainingDocument> {
  const { data, error } = await db()
    .from("sales_ai_documents")
    .insert({ file_name: row.fileName, storage_path: row.storagePath, bytes: row.bytes, purpose: row.purpose, status: "processing", created_by: row.userId })
    .select("id, file_name, purpose, status, bytes, created_at")
    .single();
  if (error || !data) throw new TrainingError("Could not save the document.");
  return toDoc(data as DocRow, false);
}

export async function finishDocument(id: string, text: string): Promise<TrainingDocument["status"]> {
  const status: TrainingDocument["status"] = text.trim().length > 50 ? "trained" : "failed";
  await db().from("sales_ai_documents").update({ extracted_text: text.trim() ? text : null, status }).eq("id", id);
  return status;
}

export async function removeDocument(id: string): Promise<string | null> {
  const { data } = await db().from("sales_ai_documents").select("id, storage_path").eq("id", id).maybeSingle();
  if (!data) return null;
  await db().from("sales_ai_documents").delete().eq("id", id);
  return (data as { storage_path: string }).storage_path;
}

/* ---------- examples ---------- */

type ExampleRow = { id: string; kind: "send" | "never"; stage_name: string | null; body: string; reason: string | null; created_at: string };

const toExample = (r: ExampleRow): TrainingExample => ({ id: r.id, kind: r.kind, stageName: r.stage_name, body: r.body, reason: r.reason, createdAt: r.created_at });

export async function listExamples(): Promise<TrainingExample[]> {
  try {
    const { data } = await db().from("sales_ai_examples").select("id, kind, stage_name, body, reason, created_at").order("created_at", { ascending: false }).limit(MAX_EXAMPLES);
    return ((data ?? []) as ExampleRow[]).map(toExample);
  } catch {
    return [];
  }
}

export async function addExample(input: { kind: "send" | "never"; stageName: string | null; body: string; reason: string | null }, userId: string): Promise<TrainingExample> {
  const { count } = await db().from("sales_ai_examples").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_EXAMPLES) throw new TrainingError(`Up to ${MAX_EXAMPLES} examples. Remove one first.`);
  const { data, error } = await db()
    .from("sales_ai_examples")
    .insert({ kind: input.kind, stage_name: input.stageName, body: input.body, reason: input.reason, created_by: userId })
    .select("id, kind, stage_name, body, reason, created_at")
    .single();
  if (error || !data) throw new TrainingError("Could not save the example.");
  return toExample(data as ExampleRow);
}

export async function removeExample(id: string): Promise<boolean> {
  const { data } = await db().from("sales_ai_examples").delete().eq("id", id).select("id");
  return (data ?? []).length > 0;
}
