import type { SupabaseClient } from "@supabase/supabase-js";
import type { FounderInvestorContactRecord, FounderInvestorContactStatus } from "@/lib/founder-crm/types";
import type { Database } from "@/lib/supabase/types";

export async function listFounderInvestorContacts(
  supabase: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
  filters?: { status?: string; search?: string },
) {
  let query = supabase
    .from("founder_investor_contacts")
    .select("*")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    return { error };
  }

  let rows = (data ?? []) as FounderInvestorContactRecord[];
  const search = filters?.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (row) =>
        row.investor_name.toLowerCase().includes(search) ||
        (row.firm_name?.toLowerCase().includes(search) ?? false) ||
        (row.email?.toLowerCase().includes(search) ?? false) ||
        row.tags.some((tag) => tag.toLowerCase().includes(search)),
    );
  }

  return { data: rows };
}

export async function createFounderInvestorContact(
  supabase: SupabaseClient<Database>,
  input: {
    founderId: string;
    companyId: string;
    investorName: string;
    firmName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    investorType?: string | null;
    preferredSectors?: string | null;
    preferredStages?: string | null;
    checkSizeMin?: number | null;
    checkSizeMax?: number | null;
    geography?: string | null;
    source?: string;
    tags?: string[];
    notes?: string | null;
    status?: FounderInvestorContactStatus;
  },
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("founder_investor_contacts")
    .insert({
      founder_id: input.founderId,
      company_id: input.companyId,
      investor_name: input.investorName.trim(),
      firm_name: input.firmName?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      investor_type: input.investorType?.trim() || null,
      preferred_sectors: input.preferredSectors?.trim() || null,
      preferred_stages: input.preferredStages?.trim() || null,
      check_size_min: input.checkSizeMin ?? null,
      check_size_max: input.checkSizeMax ?? null,
      geography: input.geography?.trim() || null,
      source: input.source ?? "manual",
      tags: input.tags ?? [],
      notes: input.notes?.trim() || null,
      status: input.status ?? "new",
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data: data as FounderInvestorContactRecord };
}

export async function updateFounderInvestorContact(
  supabase: SupabaseClient<Database>,
  input: {
    contactId: string;
    founderId: string;
    patch: Partial<{
      investor_name: string;
      firm_name: string | null;
      email: string | null;
      phone: string | null;
      website: string | null;
      investor_type: string | null;
      preferred_sectors: string | null;
      preferred_stages: string | null;
      check_size_min: number | null;
      check_size_max: number | null;
      geography: string | null;
      tags: string[];
      notes: string | null;
      status: FounderInvestorContactStatus;
    }>;
  },
) {
  const { data, error } = await supabase
    .from("founder_investor_contacts")
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq("id", input.contactId)
    .eq("founder_id", input.founderId)
    .select("*")
    .single();

  if (error) {
    return { error };
  }

  return { data: data as FounderInvestorContactRecord };
}

export async function archiveFounderInvestorContact(
  supabase: SupabaseClient<Database>,
  founderId: string,
  contactId: string,
) {
  return updateFounderInvestorContact(supabase, {
    contactId,
    founderId,
    patch: { status: "archived" },
  });
}
