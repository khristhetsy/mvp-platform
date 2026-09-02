/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getRatingConfig } from "./weights";
import { tierFromScore } from "./scoring";
import { loadPartnerScoresBatch } from "./snapshot";
import { TIER_LABELS } from "./types";

export type InvestorRating = { score: number | null; tier: string };

// The rating shown on an investor contact: their Partner Score (via a member match
// by email) plus the SEC Form D verified bonus if the contact came from Form D.
// Returns null for non-investor contacts (founders have no investor rating).
export async function getContactInvestorRating(contact: {
  source?: string | null;
  lead_source?: string | null;
  membership?: string | null;
  contact_type?: string | null;
  email?: string | null;
}): Promise<InvestorRating | null> {
  const isInvestor = (contact.membership ?? "").toLowerCase().includes("investor") || contact.contact_type === "investor";
  if (!isInvestor) return null;

  const admin = createServiceRoleClient() as unknown as SupabaseClient<any>;
  const { secFormDBonus, odooBonus } = await getRatingConfig(admin);
  const isFormD = contact.source === "formd" || contact.lead_source === "SEC Form D";
  const isOdoo = contact.source === "odoo";

  // Member match: contact email → profile → investor_profiles → partner score.
  let base: number | null = null;
  if (contact.email) {
    const { data: prof } = await admin.from("profiles").select("id").eq("email", contact.email).maybeSingle();
    const pid = (prof as { id?: string } | null)?.id;
    if (pid) {
      const { data: ip } = await admin.from("investor_profiles").select("profile_id").eq("profile_id", pid).maybeSingle();
      if (ip) base = (await loadPartnerScoresBatch(admin, [pid])).get(pid)?.score ?? null;
    }
  }

  const bonus = isFormD ? secFormDBonus : isOdoo ? odooBonus : 0;
  if (base == null && bonus <= 0) return { score: null, tier: "New" };
  const score = Math.min(100, (base ?? 0) + bonus);
  return { score, tier: TIER_LABELS[tierFromScore(score)] };
}
