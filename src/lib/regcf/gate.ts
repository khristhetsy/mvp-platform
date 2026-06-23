import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { loadFeatureFlags, isFeatureEnabled } from "@/lib/feature-controls";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import type { Company } from "@/lib/supabase/types";

/**
 * Gate for the Reg CF generator API: founder role + the `founder:regcf` feature
 * flag enabled (off by default until an admin turns it on). Resolves the
 * founder's company for AI context (optional — null if not yet created).
 */
export async function gateRegCfFounderApi() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) {
    return { error: auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  const flags = await loadFeatureFlags(auth.supabase);
  if (!isFeatureEnabled(flags, "founder", "regcf")) {
    return { error: NextResponse.json({ error: "This feature is not available." }, { status: 403 }) } as const;
  }
  let company: Company | null = null;
  try {
    company = await ensureFounderCompanyForUser(auth.profile);
  } catch {
    // Listing still works without a company; generation will use [brackets].
  }
  return { profile: auth.profile, supabase: auth.supabase, company } as const;
}
