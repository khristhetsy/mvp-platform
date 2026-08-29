// Founder-added investors (sourced off-platform: LinkedIn, AngelList, intros).
// Founder-owned rows enforced by RLS (founder_id = auth.uid()); the table isn't
// in the generated types yet, so queries run untyped as elsewhere.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const MANUAL_INVESTOR_SOURCES = ["linkedin", "angellist", "intro", "event", "inbound", "other"] as const;
export type ManualInvestorSource = (typeof MANUAL_INVESTOR_SOURCES)[number];

export const MANUAL_INVESTOR_STATUSES = ["tracking", "in_diligence", "closed", "passed"] as const;
export type ManualInvestorStatus = (typeof MANUAL_INVESTOR_STATUSES)[number];

export type ManualInvestor = {
  id: string;
  name: string;
  firm: string | null;
  email: string | null;
  source: string | null;
  check_size: string | null;
  notes: string | null;
  status: ManualInvestorStatus;
  invited: boolean;
  created_at: string;
};

export type CreateManualInvestorInput = {
  companyId: string;
  founderId: string;
  name: string;
  firm?: string | null;
  email?: string | null;
  source?: string | null;
  checkSize?: string | null;
  notes?: string | null;
  invited?: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function db(supabase: SupabaseClient<Database>): SupabaseClient<any> {
  return supabase as unknown as SupabaseClient<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listManualInvestors(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<ManualInvestor[]> {
  const { data } = await db(supabase)
    .from("founder_manual_investors")
    .select("id, name, firm, email, source, check_size, notes, status, invited, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as ManualInvestor[];
}

export async function createManualInvestor(
  supabase: SupabaseClient<Database>,
  input: CreateManualInvestorInput,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await db(supabase)
    .from("founder_manual_investors")
    .insert({
      company_id: input.companyId,
      founder_id: input.founderId,
      name: input.name.trim(),
      firm: input.firm?.trim() || null,
      email: input.email?.trim() || null,
      source: input.source?.trim() || null,
      check_size: input.checkSize?.trim() || null,
      notes: input.notes?.trim() || null,
      invited: Boolean(input.invited),
      invited_at: input.invited ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add the investor." };
  return { id: (data as { id: string }).id };
}
