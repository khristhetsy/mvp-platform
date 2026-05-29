import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";

type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];
type CompanyMemberWithCompany = { companies: Company | null };

export async function createCompany(supabase: SupabaseClient<Database>, input: CompanyInsert) {
  return supabase.from("companies").insert(input).select("*").single();
}

export async function getFounderCompany(supabase: SupabaseClient<Database>, userId: string) {
  const { data: membershipRaw, error: membershipError } = await supabase
    .from("company_members")
    .select("companies(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { data: null, error: membershipError };
  }

  const membership = membershipRaw as CompanyMemberWithCompany | null;
  if (membership?.companies) {
    return { data: membership.companies, error: null };
  }

  return supabase.from("companies").select("*").eq("founder_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
}

export async function listFounderCompanies(supabase: SupabaseClient<Database>, founderId: string) {
  const { data: membershipsRaw, error: membershipError } = await supabase
    .from("company_members")
    .select("companies(*)")
    .eq("user_id", founderId)
    .order("created_at", { ascending: false });

  if (membershipError) {
    return { data: null, error: membershipError };
  }

  const memberships = (membershipsRaw as unknown as CompanyMemberWithCompany[] | null) ?? [];
  const companies = memberships
    .map((row) => row.companies)
    .filter((company): company is NonNullable<typeof company> => Boolean(company));

  if (companies.length > 0) {
    return { data: companies, error: null };
  }

  return supabase.from("companies").select("*").eq("founder_id", founderId).order("created_at", { ascending: false });
}

export async function updateCompanyStatus(
  supabase: SupabaseClient<Database>,
  companyId: string,
  status: "draft" | "in_review" | "approved" | "rejected" | "published",
) {
  return supabase.from("companies").update({ status }).eq("id", companyId).select("*").single();
}
