"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { track } from "@/lib/analytics/posthog";
import { offeringTypeSchema, type OfferingTypeInput } from "@/lib/onboarding/offering-type-schema";

/**
 * Save the capital structure chosen inside the onboarding wizard.
 *
 * Writes the same three columns as `saveOfferingType` on the Capital structure
 * page (choice, attestation time, who attested), and re-validates the
 * attestation on the server. The difference is that it returns instead of
 * redirecting, because the wizard keeps going to its own done screen.
 */
export async function saveCapitalStructureInline(input: OfferingTypeInput): Promise<{ ok: true } | { error: string }> {
  const profile = await requireRole(["founder"]);

  const parsed = offeringTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid selection." };
  }

  const { company } = await getActiveCompanyForUser(profile);
  if (!company) return { error: "No company profile is linked to your account." };

  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { error } = await admin
    .from("companies")
    .update({
      offering_type: parsed.data.offeringType,
      offering_type_attested_at: new Date().toISOString(),
      offering_type_attested_by: profile.id,
    })
    .eq("id", company.id);

  if (error) return { error: error.message };

  try {
    track("onboarding_offering_type_submitted", { founderId: profile.id, value: parsed.data.offeringType, source: "wizard" });
  } catch {
    // analytics is best-effort
  }

  return { ok: true };
}
