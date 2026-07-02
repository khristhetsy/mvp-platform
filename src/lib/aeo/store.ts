// AEO data-access. Uses the service-role client (writes are admin-gated at the API
// layer; the public render path reads published rows server-side).

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rowToPage, type AeoPage, type AeoPageRow, type AeoStatus, type ComplianceStatus } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): SupabaseClient<any> {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

const COLS =
  "id,slug,status,eyebrow,h1,lede,definition_answer,defined_term,sections,faq,meta_description,compliance_status,published_at,updated_at";

export async function listPages(): Promise<AeoPage[]> {
  const { data } = await db().from("aeo_pages").select(COLS).order("updated_at", { ascending: false });
  return (data ?? []).map((r) => rowToPage(r as AeoPageRow));
}

export async function getPage(id: string): Promise<AeoPage | null> {
  const { data } = await db().from("aeo_pages").select(COLS).eq("id", id).maybeSingle();
  return data ? rowToPage(data as AeoPageRow) : null;
}

/** Published page by slug — the public render path. */
export async function getPublishedBySlug(slug: string): Promise<AeoPage | null> {
  const { data } = await db().from("aeo_pages").select(COLS).eq("slug", slug).eq("status", "published").maybeSingle();
  return data ? rowToPage(data as AeoPageRow) : null;
}

export async function listPublishedSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const { data } = await db().from("aeo_pages").select("slug,updated_at").eq("status", "published");
  return (data ?? []).map((r: { slug: string; updated_at: string }) => ({ slug: r.slug, updatedAt: r.updated_at }));
}

export interface AeoWritable {
  slug?: string;
  eyebrow?: string;
  h1?: string;
  lede?: string;
  definition_answer?: string;
  defined_term?: string | null;
  sections?: unknown;
  faq?: unknown;
  meta_description?: string;
  status?: AeoStatus;
}

export async function createPage(input: AeoWritable): Promise<AeoPage> {
  const row = {
    slug: input.slug,
    eyebrow: input.eyebrow ?? null,
    h1: input.h1 ?? "Untitled",
    lede: input.lede ?? null,
    definition_answer: input.definition_answer ?? "",
    defined_term: input.defined_term ?? null,
    sections: input.sections ?? [],
    faq: input.faq ?? [],
    meta_description: input.meta_description ?? null,
    status: "draft" as AeoStatus,
  };
  const { data, error } = await db().from("aeo_pages").insert(row).select(COLS).single();
  if (error) throw new Error(error.message);
  return rowToPage(data as AeoPageRow);
}

/** Editing content resets compliance to unreviewed — re-check required before publish. */
export async function updatePage(id: string, patch: AeoWritable): Promise<AeoPage> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString(), compliance_status: "unreviewed" };
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) row[k] = v;
  const { data, error } = await db().from("aeo_pages").update(row).eq("id", id).select(COLS).single();
  if (error) throw new Error(error.message);
  return rowToPage(data as AeoPageRow);
}

export async function setComplianceStatus(id: string, status: ComplianceStatus): Promise<void> {
  const { error } = await db().from("aeo_pages").update({ compliance_status: status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setStatus(id: string, status: AeoStatus, publishedAt: string | null): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "published") patch.published_at = publishedAt ?? new Date().toISOString();
  const { error } = await db().from("aeo_pages").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function logAction(
  pageId: string,
  action: "published" | "unpublished" | "compliance_cleared" | "compliance_flagged",
  adminId: string,
  detail?: string,
): Promise<void> {
  await db().from("aeo_publish_log").insert({ page_id: pageId, action, admin_id: adminId, detail: detail ?? null });
}

// ── Exposure gate (§1 fix-first blockers) ────────────────────────────────────
export interface AeoSettings {
  deal_names_masked: boolean;
  security_page_noindexed: boolean;
}

export async function getSettings(): Promise<AeoSettings> {
  const { data } = await db().from("aeo_settings").select("deal_names_masked,security_page_noindexed").eq("id", true).maybeSingle();
  return {
    deal_names_masked: !!data?.deal_names_masked,
    security_page_noindexed: !!data?.security_page_noindexed,
  };
}

export async function updateSettings(patch: Partial<AeoSettings>, adminId: string): Promise<void> {
  const row = { id: true, ...patch, updated_by: adminId, updated_at: new Date().toISOString() };
  const { error } = await db().from("aeo_settings").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
}
