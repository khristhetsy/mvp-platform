import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

// Explicit tombstone column allowlist. NEVER select('*') — new columns must be
// consciously admitted to the public payload. `lead_prescore` is never selected;
// the public band lives in `readiness_band`.
export const TOMBSTONE_COLUMNS =
  "id, slug, company_name, brief_description, industry, location, offering_amount_min, offering_amount_max, security_type, portal_name, portal_url, logo_path, readiness_band, published_at";

export type Listing = {
  id: string;
  slug: string | null;
  companyName: string;
  briefDescription: string;
  industry: string | null;
  location: string | null;
  offeringAmountMin: number | null;
  offeringAmountMax: number | null;
  securityType: string | null;
  portalName: string;
  portalUrl: string;
  logoPath: string | null;
  readinessBand: string | null;
  publishedAt: string | null;
};

type Row = {
  id: string;
  slug: string | null;
  company_name: string;
  brief_description: string;
  industry: string | null;
  location: string | null;
  offering_amount_min: number | null;
  offering_amount_max: number | null;
  security_type: string | null;
  portal_name: string;
  portal_url: string;
  logo_path: string | null;
  readiness_band: string | null;
  published_at: string | null;
};

function mapRow(r: Row): Listing {
  return {
    id: r.id,
    slug: r.slug,
    companyName: r.company_name,
    briefDescription: r.brief_description,
    industry: r.industry,
    location: r.location,
    offeringAmountMin: r.offering_amount_min,
    offeringAmountMax: r.offering_amount_max,
    securityType: r.security_type,
    portalName: r.portal_name,
    portalUrl: r.portal_url,
    logoPath: r.logo_path,
    readinessBand: r.readiness_band,
    publishedAt: r.published_at,
  };
}

function db(): SupabaseClient {
  // Public reads: only ever LIVE + tombstone columns. Service role avoids any
  // per-request auth/RLS-context flakiness on this anon-facing page.
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function getLiveListings(): Promise<Listing[]> {
  const { data } = await db()
    .from("marketplace_listings")
    .select(TOMBSTONE_COLUMNS)
    .eq("status", "live")
    .order("published_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).map(mapRow);
}

export async function getListingBySlug(slug: string): Promise<Listing | null> {
  const { data } = await db()
    .from("marketplace_listings")
    .select(TOMBSTONE_COLUMNS)
    .eq("status", "live")
    .eq("slug", slug)
    .maybeSingle();
  return data ? mapRow(data as Row) : null;
}

export async function getLiveSlugs(): Promise<string[]> {
  const { data } = await db()
    .from("marketplace_listings")
    .select("slug")
    .eq("status", "live")
    .not("slug", "is", null)
    .limit(1000);
  return ((data ?? []) as Array<{ slug: string | null }>).map((r) => r.slug).filter((s): s is string => Boolean(s));
}
