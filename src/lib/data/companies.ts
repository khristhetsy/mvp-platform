import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];

export async function createCompany(supabase: SupabaseClient<Database>, input: CompanyInsert) {
  return supabase.from("companies").insert(input).select("*").single();
}

export async function listFounderCompanies(supabase: SupabaseClient<Database>, founderId: string) {
  return supabase.from("companies").select("*").eq("founder_id", founderId).order("created_at", { ascending: false });
}

export async function updateCompanyStatus(
  supabase: SupabaseClient<Database>,
  companyId: string,
  status: "draft" | "in_review" | "approved" | "rejected" | "published",
) {
  return supabase.from("companies").update({ status }).eq("id", companyId).select("*").single();
}
