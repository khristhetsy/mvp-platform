// Bridge to the platform's existing companies table for the engagement picker
// and founder auto-resolution. Service role.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type CompanyOption = {
  id: string;
  company_name: string;
  industry: string | null;
  has_founder: boolean;
};

export async function listCompaniesForPicker(supabase: SupabaseClient<Database>): Promise<CompanyOption[]> {
  const { data } = await raw(supabase)
    .from("companies")
    .select("id, company_name, industry, founder_id")
    .order("company_name", { ascending: true })
    .limit(500);
  return ((data ?? []) as Array<{ id: string; company_name: string; industry: string | null; founder_id: string | null }>).map((c) => ({
    id: c.id,
    company_name: c.company_name,
    industry: c.industry,
    has_founder: Boolean(c.founder_id),
  }));
}

export type CompanyContext = {
  companyName: string;
  industry: string | null;
  businessDescription: string | null;
  founderId: string | null;
  founderEmail: string | null;
};

export async function getCompanyContext(supabase: SupabaseClient<Database>, companyId: string): Promise<CompanyContext | null> {
  const { data } = await raw(supabase)
    .from("companies")
    .select("company_name, industry, business_description, founder_id")
    .eq("id", companyId)
    .maybeSingle();
  const c = data as { company_name?: string; industry?: string | null; business_description?: string | null; founder_id?: string | null } | null;
  if (!c) return null;

  let founderEmail: string | null = null;
  if (c.founder_id) {
    const { data: prof } = await raw(supabase).from("profiles").select("email").eq("id", c.founder_id).maybeSingle();
    founderEmail = (prof as { email?: string } | null)?.email ?? null;
  }

  return {
    companyName: c.company_name ?? "",
    industry: c.industry ?? null,
    businessDescription: c.business_description ?? null,
    founderId: c.founder_id ?? null,
    founderEmail,
  };
}
