// iCFO Events — Marketing Hub data model. One row per event holds the staff
// marketing kit. Tables aren't in generated types yet — local raw() cast.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Row = Record<string, unknown>;
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export interface Brochure {
  headline: string;
  subhead: string;
  body: string;
  highlights: string[];
  cta: string;
}

export interface EmailInvite {
  subject: string;
  preheader: string;
  body: string;
}

export interface SocialDrafts {
  linkedin: string;
  facebook: string;
  instagram: string;
}

export interface EventMarketing {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  brochure: Brochure;
  email: EmailInvite;
  social: SocialDrafts;
  updatedAt: string | null;
}

export function emptyBrochure(): Brochure {
  return { headline: "", subhead: "", body: "", highlights: [], cta: "" };
}
export function emptyEmail(): EmailInvite {
  return { subject: "", preheader: "", body: "" };
}
export function emptySocial(): SocialDrafts {
  return { linkedin: "", facebook: "", instagram: "" };
}

/** A blank kit (used when an event has no marketing row yet). */
export function emptyMarketing(): EventMarketing {
  return {
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    brochure: emptyBrochure(),
    email: emptyEmail(),
    social: emptySocial(),
    updatedAt: null,
  };
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function mapBrochure(j: unknown): Brochure {
  const o = (j ?? {}) as Record<string, unknown>;
  return {
    headline: asStr(o.headline),
    subhead: asStr(o.subhead),
    body: asStr(o.body),
    highlights: Array.isArray(o.highlights) ? o.highlights.map(asStr).filter(Boolean) : [],
    cta: asStr(o.cta),
  };
}
function mapEmail(j: unknown): EmailInvite {
  const o = (j ?? {}) as Record<string, unknown>;
  return { subject: asStr(o.subject), preheader: asStr(o.preheader), body: asStr(o.body) };
}
function mapSocial(j: unknown): SocialDrafts {
  const o = (j ?? {}) as Record<string, unknown>;
  return { linkedin: asStr(o.linkedin), facebook: asStr(o.facebook), instagram: asStr(o.instagram) };
}

function mapRow(r: Row): EventMarketing {
  return {
    seoTitle: asStr(r.seo_title),
    seoDescription: asStr(r.seo_description),
    seoKeywords: asStr(r.seo_keywords),
    brochure: mapBrochure(r.brochure),
    email: mapEmail(r.email_invite),
    social: mapSocial(r.social),
    updatedAt: (r.updated_at as string | null) ?? null,
  };
}

/** Load the marketing kit for an event, or a blank kit if none exists. */
export async function loadMarketing(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<EventMarketing> {
  const { data } = await raw(supabase).from("event_marketing").select("*").eq("event_id", eventId).maybeSingle();
  return data ? mapRow(data as Row) : emptyMarketing();
}

export type MarketingPatch = Partial<Omit<EventMarketing, "updatedAt">>;

/** Upsert the marketing kit (staff). Only provided sections are overwritten. */
export async function saveMarketing(
  supabase: SupabaseClient<Database>,
  eventId: string,
  userId: string,
  patch: MarketingPatch,
): Promise<EventMarketing> {
  const row: Row = { event_id: eventId, updated_by: userId };
  if (patch.seoTitle !== undefined) row.seo_title = patch.seoTitle;
  if (patch.seoDescription !== undefined) row.seo_description = patch.seoDescription;
  if (patch.seoKeywords !== undefined) row.seo_keywords = patch.seoKeywords;
  if (patch.brochure !== undefined) row.brochure = patch.brochure;
  if (patch.email !== undefined) row.email_invite = patch.email;
  if (patch.social !== undefined) row.social = patch.social;

  const { data, error } = await raw(supabase)
    .from("event_marketing")
    .upsert(row, { onConflict: "event_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Row);
}
