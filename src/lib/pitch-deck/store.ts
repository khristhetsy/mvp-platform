// Data access for the founder pitch deck (one row per company). Mirrors business-plan store.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { PitchDeck } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}
type Row = Record<string, unknown>;

function mapDeck(r: Row): PitchDeck {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    slides: (r.slides as PitchDeck["slides"]) ?? {},
    theme: (r.theme as string) ?? "navy",
    status: (r.status as PitchDeck["status"]) ?? "draft",
    shareToken: (r.share_token as string | null) ?? null,
    aiAssisted: Boolean(r.ai_assisted),
    generatedAt: (r.generated_at as string | null) ?? null,
    finalizedAt: (r.finalized_at as string | null) ?? null,
    updatedAt: (r.updated_at as string | null) ?? null,
  };
}

export async function getPitchDeck(supabase: SupabaseClient<Database>, companyId: string): Promise<PitchDeck | null> {
  const { data, error } = await raw(supabase).from("pitch_decks").select("*").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDeck(data as Row) : null;
}

export async function getPitchDeckByToken(supabase: SupabaseClient<Database>, token: string): Promise<PitchDeck | null> {
  const { data, error } = await raw(supabase).from("pitch_decks").select("*").eq("share_token", token).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDeck(data as Row) : null;
}

export interface PitchDeckPatch {
  slides?: PitchDeck["slides"];
  theme?: string;
  status?: PitchDeck["status"];
  shareToken?: string | null;
  aiAssisted?: boolean;
}

export async function upsertPitchDeck(
  supabase: SupabaseClient<Database>,
  companyId: string,
  editorId: string,
  patch: PitchDeckPatch,
): Promise<PitchDeck> {
  const record: Record<string, unknown> = { company_id: companyId, last_edited_by: editorId, updated_at: new Date().toISOString() };
  if (patch.slides !== undefined) record.slides = patch.slides;
  if (patch.theme !== undefined) record.theme = patch.theme;
  if (patch.shareToken !== undefined) record.share_token = patch.shareToken;
  if (patch.aiAssisted !== undefined) record.ai_assisted = patch.aiAssisted;
  if (patch.status !== undefined) {
    record.status = patch.status;
    if (patch.status === "finalized") record.finalized_at = new Date().toISOString();
  }
  const { data, error } = await raw(supabase).from("pitch_decks").upsert(record, { onConflict: "company_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return mapDeck(data as Row);
}
