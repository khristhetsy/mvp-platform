import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureCampaignForListedCompany,
  ensureCompanySlug,
  isCompanyMarketplaceListed,
} from "@/lib/data/marketplace";
import type { Company, Database } from "@/lib/supabase/types";

export type DealTarget = {
  companyId: string;
  companyName: string;
  founderId: string;
  campaignId: string | null;
  campaignSlug: string;
  company: Company;
};

export type ResolveDealTargetInput = {
  companyId?: string;
  companySlug?: string;
  createCampaignIfMissing?: boolean;
};

export type ResolveDealTargetOptions = {
  /** Required when createCampaignIfMissing is true — bypasses campaigns/companies RLS for repair. */
  serviceSupabase?: SupabaseClient<Database>;
};

export async function resolveDealTarget(
  supabase: SupabaseClient<Database>,
  input: ResolveDealTargetInput,
  options: ResolveDealTargetOptions = {},
) {
  if (!input.companyId && !input.companySlug) {
    return { error: { message: "companyId or companySlug is required.", code: "invalid_target" } };
  }

  if (input.createCampaignIfMissing && !options.serviceSupabase) {
    return {
      error: {
        message: "Service role client is required to repair missing campaigns.",
        code: "service_client_required",
      },
    };
  }

  const readSupabase = options.serviceSupabase ?? supabase;
  let company: Company | null = null;

  if (input.companyId) {
    const { data, error } = await readSupabase.from("companies").select("*").eq("id", input.companyId).maybeSingle();
    if (error) {
      return { error };
    }
    company = (data as Company | null) ?? null;
  } else if (input.companySlug) {
    const { data, error } = await readSupabase
      .from("companies")
      .select("*")
      .eq("slug", input.companySlug)
      .maybeSingle();
    if (error) {
      return { error };
    }
    company = (data as Company | null) ?? null;

    if (!company) {
      const { data: campaign } = await readSupabase
        .from("campaigns")
        .select("company_id")
        .eq("slug", input.companySlug)
        .maybeSingle();

      if (campaign?.company_id) {
        const { data: linkedCompany, error: linkedError } = await readSupabase
          .from("companies")
          .select("*")
          .eq("id", campaign.company_id)
          .maybeSingle();

        if (linkedError) {
          return { error: linkedError };
        }

        company = (linkedCompany as Company | null) ?? null;
      }
    }
  }

  if (!company) {
    return { error: { message: "Deal not found.", code: "deal_not_found" } };
  }

  if (!isCompanyMarketplaceListed(company)) {
    return { error: { message: "This deal is not currently listed on the marketplace.", code: "deal_not_listed" } };
  }

  const repairSupabase = options.serviceSupabase!;
  let slug = company.slug;

  if (!slug) {
    if (!options.serviceSupabase) {
      return {
        error: {
          message: "Service role client is required to assign a marketplace slug.",
          code: "service_client_required",
        },
      };
    }
    slug = await ensureCompanySlug(repairSupabase, company);
  }

  let campaignId: string | null = null;

  const { data: campaign } = await readSupabase
    .from("campaigns")
    .select("id, slug")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  campaignId = campaign?.id ?? null;

  if (input.createCampaignIfMissing && !campaignId) {
    const ensured = await ensureCampaignForListedCompany(repairSupabase, { ...company, slug });
    if ("error" in ensured && ensured.error) {
      return { error: ensured.error };
    }
    campaignId = ensured.data?.id ?? null;
  }

  return {
    data: {
      companyId: company.id,
      companyName: company.company_name,
      founderId: company.founder_id,
      campaignId,
      campaignSlug: slug,
      company: { ...company, slug },
    } satisfies DealTarget,
  };
}

/** @deprecated Use resolveDealTarget instead */
export async function resolveDealTargetBySlug(supabase: SupabaseClient<Database>, slug: string) {
  return resolveDealTarget(supabase, { companySlug: slug, createCampaignIfMissing: false });
}

export function assertInvestorCanActOnDeal(investorId: string, target: DealTarget) {
  if (target.founderId === investorId) {
    return {
      error: {
        message: "You cannot perform investor actions on your own company listing.",
        code: "self_dealing_blocked",
      },
    };
  }

  return { ok: true as const };
}

export async function getPitchDeckDocumentId(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const { data } = await supabase
    .from("documents")
    .select("id")
    .eq("company_id", companyId)
    .eq("document_type", "PITCH_DECK")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
