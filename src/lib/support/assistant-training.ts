/**
 * Server side store for the support assistant's training: the product knowledge
 * text and dismissed gaps (one JSON row each in `platform_settings`), taught
 * answers and PDF sources (their own tables). Every read is defensive: a
 * missing table or row returns empty training and the assistant answers as it
 * did before training existed.
 */
import "server-only";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { buildGaps, gapKey, type Gap } from "./assistant-gaps";
import { EMPTY_TRAINING, type AssistantTraining } from "./assistant-prompt";

export const BRIEF_KEY = "support_assistant_brief";
export const DISMISSED_KEY = "support_assistant_dismissed_gaps";
export const MAX_ANSWERS = 60;
export const MAX_SOURCES = 10;
export const MAX_BRIEF_CHARS = 6000;

export type TaughtRow = { id: string; question: string; answer: string };
export type SourceRow = { id: string; file_name: string; bytes: number; status: "processing" | "trained" | "failed"; created_at: string };

async function getSetting(key: string): Promise<unknown> {
  try {
    const { data } = await serviceRoleClientUntyped().from("platform_settings").select("value").eq("key", key).maybeSingle();
    return (data as { value?: unknown } | null)?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: unknown, updatedBy: string | null): Promise<boolean> {
  try {
    const { error } = await serviceRoleClientUntyped()
      .from("platform_settings")
      .upsert({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}

/** The saved product knowledge text, or null when the default is in use. */
export async function getBriefTemplate(): Promise<string | null> {
  const v = (await getSetting(BRIEF_KEY)) as { text?: unknown } | null;
  return typeof v?.text === "string" && v.text.trim() ? v.text : null;
}

/** Empty text clears the saved version and returns to the default. */
export async function saveBriefTemplate(text: string, updatedBy: string | null): Promise<boolean> {
  return setSetting(BRIEF_KEY, { text: text.trim().slice(0, MAX_BRIEF_CHARS) }, updatedBy);
}

export async function listTaughtAnswers(): Promise<TaughtRow[]> {
  try {
    const { data } = await serviceRoleClientUntyped().from("support_assistant_answers").select("id, question, answer").order("created_at", { ascending: false }).limit(MAX_ANSWERS);
    return (data ?? []) as TaughtRow[];
  } catch {
    return [];
  }
}

export async function listSources(): Promise<SourceRow[]> {
  try {
    const { data } = await serviceRoleClientUntyped().from("support_assistant_sources").select("id, file_name, bytes, status, created_at").order("created_at", { ascending: false }).limit(MAX_SOURCES);
    return (data ?? []) as SourceRow[];
  } catch {
    return [];
  }
}

/** Everything the assistant reads on a question. Never throws. */
export async function loadAssistantTraining(): Promise<AssistantTraining> {
  try {
    const db = serviceRoleClientUntyped();
    const [briefTemplate, taught, src] = await Promise.all([
      getBriefTemplate(),
      listTaughtAnswers(),
      db.from("support_assistant_sources").select("extracted_text").eq("status", "trained").order("created_at", { ascending: false }).limit(MAX_SOURCES),
    ]);
    const sources = ((src.data ?? []) as Array<{ extracted_text: string | null }>).map((r) => r.extracted_text ?? "").filter(Boolean);
    return { briefTemplate, taught, sources };
  } catch {
    return EMPTY_TRAINING;
  }
}

async function getDismissed(): Promise<string[]> {
  const v = (await getSetting(DISMISSED_KEY)) as { items?: unknown } | null;
  return Array.isArray(v?.items) ? (v.items as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

export async function dismissGap(question: string, updatedBy: string | null): Promise<boolean> {
  const key = gapKey(question);
  if (key.length < 3) return false;
  const next = [key, ...(await getDismissed()).filter((k) => k !== key)].slice(0, 200);
  return setSetting(DISMISSED_KEY, { items: next }, updatedBy);
}

const GAP_WINDOW_DAYS = 60;

/** Questions founders still needed a person for, most asked first. */
export async function listGaps(taught: TaughtRow[]): Promise<Gap[]> {
  try {
    const since = new Date(Date.now() - GAP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await serviceRoleClientUntyped()
      .from("support_events")
      .select("detail, created_at, founder_id")
      .eq("kind", "ai_answer_needs_person")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    const rows = (data ?? []) as Array<{ detail: string | null; created_at: string; founder_id: string | null }>;
    // The investor assistant logs the same event kind; this list is the founder assistant's.
    const ids = [...new Set(rows.map((r) => r.founder_id).filter((x): x is string => Boolean(x)))];
    const { data: founders } = ids.length ? await serviceRoleClientUntyped().from("profiles").select("id").in("id", ids).eq("role", "founder") : { data: [] };
    const founderIds = new Set(((founders ?? []) as Array<{ id: string }>).map((f) => f.id));
    return buildGaps(rows.filter((r) => r.founder_id && founderIds.has(r.founder_id)), await getDismissed(), taught);
  } catch {
    return [];
  }
}
