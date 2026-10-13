import type { SupabaseClient } from "@supabase/supabase-js";
import { trackedUrl } from "./slug";

/**
 * The tracked email link of the live IR agent that belongs to a company's
 * organization, or null when the company has no org or no live agent. Used by
 * the founder email composer and the manual outreach sender.
 */
export async function liveAgentEmailUrlForCompany(db: SupabaseClient, companyId: string): Promise<string | null> {
  try {
    const { data: company } = await db.from("companies").select("org_id").eq("id", companyId).maybeSingle();
    const orgId = (company as { org_id?: string | null } | null)?.org_id;
    if (!orgId) return null;
    const { data: agent } = await db.from("ir_agents").select("company_slug, ending").eq("organization_id", orgId).eq("status", "live").maybeSingle();
    const a = agent as { company_slug: string; ending: string } | null;
    return a ? trackedUrl(a.company_slug, a.ending, "email") : null;
  } catch {
    return null;
  }
}
