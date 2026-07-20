"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiProfile } from "@/lib/api/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { track } from "@/lib/analytics/posthog";
import { listingInputSchema, validateListing, type ListingInput } from "@/lib/marketplace/validation";

export type CreateListingResult = { ok: true } | { ok: false; error: string };

/**
 * Founder creates a marketplace listing. Reg-CF-only (checked here for a friendly
 * error; the DB trigger is the hard enforcement). Always enters `pending_review`
 * — a human approves before it goes live.
 */
export async function createListing(input: ListingInput): Promise<CreateListingResult> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return { ok: false, error: "Sign in as a founder to continue." };

  const parsed = listingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid listing." };

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return { ok: false, error: "No company profile is linked to your account." };

  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  // Reg-CF gate (friendly): only Reg CF companies may list.
  const { data: co } = await admin.from("companies").select("offering_type").eq("id", company.id).maybeSingle();
  if ((co as { offering_type?: string } | null)?.offering_type !== "reg_cf") {
    return { ok: false, error: "Only Reg CF companies can create a public marketplace listing. Update your capital structure first." };
  }

  const v = validateListing(parsed.data);
  if (!v.ok) return { ok: false, error: v.errors.join(" ") };

  const { error } = await admin.from("marketplace_listings").insert({
    company_id: company.id,
    status: "pending_review",
    company_name: parsed.data.companyName,
    brief_description: parsed.data.briefDescription,
    industry: parsed.data.industry || null,
    location: parsed.data.location || null,
    security_type: parsed.data.securityType || null,
    offering_amount_min: parsed.data.offeringAmountMin ?? null,
    offering_amount_max: parsed.data.offeringAmountMax ?? null,
    portal_name: parsed.data.portalName,
    portal_url: parsed.data.portalUrl,
  });
  if (error) {
    // Trigger rejection (non-reg-cf) or other DB error.
    return { ok: false, error: error.message.includes("Reg CF") ? "Only Reg CF companies can create a listing." : error.message };
  }

  try {
    track("marketplace_listing_submitted", { companyId: company.id, portalFlagged: v.portalFlagged });
  } catch {
    /* best-effort */
  }
  return { ok: true };
}
