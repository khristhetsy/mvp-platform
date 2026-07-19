"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { track } from "@/lib/analytics/posthog";
import { offeringTypeSchema, type OfferingTypeInput } from "@/lib/onboarding/offering-type-schema";

/**
 * Persist the founder's attested capital structure onto their company, then
 * continue onboarding. Never trusts the client's gating — re-validates the
 * attestation server-side.
 */
export async function saveOfferingType(input: OfferingTypeInput): Promise<{ error: string } | void> {
  const profile = await requireRole(["founder"]);

  const parsed = offeringTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid selection." };
  }

  const company = await ensureFounderCompanyForUser(profile);
  if (!company) return { error: "No company profile is linked to your account." };

  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("companies")
    .update({
      offering_type: parsed.data.offeringType,
      offering_type_attested_at: now,
      offering_type_attested_by: profile.id,
    })
    .eq("id", company.id);

  if (error) return { error: error.message };

  try {
    track("onboarding_offering_type_submitted", { founderId: profile.id, value: parsed.data.offeringType });
  } catch {
    // analytics is best-effort
  }

  redirect("/founder/onboarding");
}
