import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type InvestorInterestInsert = Database["public"]["Tables"]["investor_interests"]["Insert"];

export async function createInvestorInterest(supabase: SupabaseClient<Database>, input: InvestorInterestInsert) {
  return supabase.from("investor_interests").insert(input).select("*").single();
}

export async function listInvestorInterests(supabase: SupabaseClient<Database>, investorId: string) {
  return supabase
    .from("investor_interests")
    .select("*, campaigns(*)")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });
}
