// Event Brochure — edition CRUD against event_brochures (build spec §4/§7).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { defaultPageConfig, type BrochureEdition, type BrochurePage, type BrochureSize } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}
type Row = Record<string, unknown>;

function mapEdition(r: Row): BrochureEdition {
  return {
    id: String(r.id),
    eventId: String(r.event_id),
    baseEditionId: (r.base_edition_id as string | null) ?? null,
    title: String(r.title),
    status: r.status as BrochureEdition["status"],
    pageConfig: Array.isArray(r.page_config) ? (r.page_config as BrochurePage[]) : [],
    overrides: (r.overrides as Record<string, Record<string, string>>) ?? {},
    size: (r.size as BrochureSize) ?? "letter",
    coverThumbPath: (r.cover_thumb_path as string | null) ?? null,
    pdfDigitalPath: (r.pdf_digital_path as string | null) ?? null,
    pdfPrintPath: (r.pdf_print_path as string | null) ?? null,
    published: Boolean(r.published),
    publishedAt: (r.published_at as string | null) ?? null,
    generatedAt: (r.generated_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listEditions(
  supabase: SupabaseClient<Database>,
  eventId?: string,
): Promise<BrochureEdition[]> {
  let q = raw(supabase).from("event_brochures").select("*").order("created_at", { ascending: false });
  if (eventId) q = q.eq("event_id", eventId);
  const { data } = await q;
  return ((data ?? []) as Row[]).map(mapEdition);
}

export async function getEdition(supabase: SupabaseClient<Database>, id: string): Promise<BrochureEdition | null> {
  const { data } = await raw(supabase).from("event_brochures").select("*").eq("id", id).maybeSingle();
  return data ? mapEdition(data as Row) : null;
}

/** Create a draft edition. With baseEditionId, copies structure + size only —
 *  never pulled data or Tier-2 overrides (§7); data re-pulls from the event. */
export async function createEdition(
  supabase: SupabaseClient<Database>,
  input: { eventId: string; title: string; baseEditionId?: string; createdBy?: string },
): Promise<BrochureEdition> {
  let pageConfig: BrochurePage[] = defaultPageConfig();
  let size: BrochureSize = "letter";
  if (input.baseEditionId) {
    const base = await getEdition(supabase, input.baseEditionId);
    if (base) { pageConfig = base.pageConfig; size = base.size; }
  }
  const { data, error } = await raw(supabase)
    .from("event_brochures")
    .insert({
      event_id: input.eventId,
      base_edition_id: input.baseEditionId ?? null,
      title: input.title,
      page_config: pageConfig,
      size,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapEdition(data as Row);
}

export async function updateEdition(
  supabase: SupabaseClient<Database>,
  id: string,
  patch: { title?: string; pageConfig?: BrochurePage[]; overrides?: Record<string, Record<string, string>>; size?: BrochureSize },
): Promise<BrochureEdition> {
  const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) p.title = patch.title;
  if (patch.pageConfig !== undefined) p.page_config = patch.pageConfig;
  if (patch.overrides !== undefined) p.overrides = patch.overrides;
  if (patch.size !== undefined) p.size = patch.size;
  const { data, error } = await raw(supabase).from("event_brochures").update(p).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return mapEdition(data as Row);
}

/** Freeze the merge snapshot and mark generated, optionally with PDF paths. */
export async function markGenerated(
  supabase: SupabaseClient<Database>,
  id: string,
  mergeSnapshot: unknown,
  paths?: { printPath?: string | null; digitalPath?: string | null },
): Promise<BrochureEdition> {
  const patch: Record<string, unknown> = {
    status: "generated",
    generated_at: new Date().toISOString(),
    merge_snapshot: mergeSnapshot,
    updated_at: new Date().toISOString(),
  };
  if (paths?.printPath !== undefined) patch.pdf_print_path = paths.printPath;
  if (paths?.digitalPath !== undefined) patch.pdf_digital_path = paths.digitalPath;
  const { data, error } = await raw(supabase).from("event_brochures").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return mapEdition(data as Row);
}

/** Toggle whether the digital PDF is exposed on the public event page (§9).
 *  Only generated editions with a stored digital PDF can be published. */
export async function setPublished(
  supabase: SupabaseClient<Database>,
  id: string,
  published: boolean,
): Promise<BrochureEdition> {
  const { data, error } = await raw(supabase)
    .from("event_brochures")
    .update({ published, published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapEdition(data as Row);
}

export const BROCHURE_BUCKET = "event-brochures";

/** Upload a generated PDF and return its storage path. */
export async function uploadBrochurePdf(
  supabase: SupabaseClient<Database>,
  editionId: string,
  variant: "print" | "digital",
  bytes: Buffer,
): Promise<string> {
  const path = `${editionId}/${variant}.pdf`;
  const { error } = await raw(supabase).storage.from(BROCHURE_BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/** Signed URL for a stored brochure PDF (private bucket). */
export async function brochureSignedUrl(supabase: SupabaseClient<Database>, path: string, ttl = 3600): Promise<string | null> {
  const { data, error } = await raw(supabase).storage.from(BROCHURE_BUCKET).createSignedUrl(path, ttl);
  return error ? null : data?.signedUrl ?? null;
}
