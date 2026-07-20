import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDebug } from "@/lib/debug/admin-debug";
import type { Company, Database } from "@/lib/supabase/types";

export type MarketplaceListing = {
  id: string;
  slug: string;
  companyName: string;
  founderId: string;
  industry: string | null;
  stage: string | null;
  location: string | null;
  country: string | null;
  incorporationJurisdiction: string | null;
  shortSummary: string | null;
  fundingTarget: string | null;
  minimumInvestment: string | null;
  useOfFunds: string | null;
  overview: string | null;
  problem: string | null;
  solution: string | null;
  marketOpportunity: string | null;
  traction: string | null;
  team: string | null;
  riskDisclosures: string | null;
  diligenceSummary: string | null;
  publishedAt: string | null;
  capitalReadyAt: string | null;
};

export function getCompanyTitle(company: Pick<Company, "company_name">) {
  const title = company.company_name?.trim();
  return title || "Company listing";
}

export function slugifyCompanyName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return base || "company";
}

async function resolveCampaignSlug(
  supabase: SupabaseClient<Database>,
  companyId: string,
  preferredSlug: string,
) {
  const { data: conflict } = await supabase
    .from("campaigns")
    .select("id, company_id")
    .eq("slug", preferredSlug)
    .maybeSingle();

  if (!conflict || conflict.company_id === companyId) {
    return preferredSlug;
  }

  return `${preferredSlug}-${companyId.slice(0, 8)}`;
}

export async function ensureCompanySlug(
  supabase: SupabaseClient<Database>,
  company: Pick<Company, "id" | "company_name" | "slug">,
) {
  if (company.slug) {
    return company.slug;
  }

  const candidate = slugifyCompanyName(company.company_name);
  let suffix = 0;

  while (suffix < 20) {
    const slug = suffix === 0 ? candidate : `${candidate}-${suffix}`;
    const { data: conflict } = await supabase.from("companies").select("id").eq("slug", slug).maybeSingle();

    if (!conflict || conflict.id === company.id) {
      await supabase.from("companies").update({ slug }).eq("id", company.id);
      return slug;
    }

    suffix += 1;
  }

  const fallback = `${candidate}-${company.id.slice(0, 8)}`;
  await supabase.from("companies").update({ slug: fallback }).eq("id", company.id);
  return fallback;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatLocation(company: Company) {
  const parts = [company.state, company.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function mapCompanyToListing(
  company: Company,
  slug: string,
  campaign?: {
    problem: string | null;
    solution: string | null;
    market_opportunity: string | null;
    traction: string | null;
    use_of_funds: string | null;
    risk_disclosures: string | null;
    funding_target: number | null;
    minimum_investment: number | null;
  } | null,
): MarketplaceListing {
  return {
    id: company.id,
    slug,
    companyName: company.company_name,
    founderId: company.founder_id,
    industry: company.industry,
    stage: company.revenue_stage,
    location: formatLocation(company),
    country: company.country,
    incorporationJurisdiction: company.incorporation_jurisdiction,
    shortSummary: company.business_description,
    fundingTarget: formatCurrency(campaign?.funding_target ?? company.funding_amount),
    minimumInvestment: formatCurrency(campaign?.minimum_investment),
    useOfFunds: campaign?.use_of_funds ?? company.use_of_funds,
    overview: company.business_description,
    problem: campaign?.problem ?? company.business_description,
    solution: campaign?.solution ?? company.business_description,
    marketOpportunity: campaign?.market_opportunity ?? company.industry,
    traction: campaign?.traction ?? company.revenue_stage,
    team: company.team_summary,
    riskDisclosures:
      campaign?.risk_disclosures ??
      "This opportunity is for informational purposes only and does not constitute an offer to sell securities.",
    diligenceSummary: company.business_description,
    publishedAt: company.published_at ?? null,
    capitalReadyAt: company.capital_ready_at ?? null,
  };
}

export function isCompanyMarketplaceListed(company: Pick<
  Company,
  "review_status" | "is_published" | "marketplace_visible" | "published_at" | "offering_type"
> & { is_sample?: boolean | null }) {
  return (
    company.review_status === "approved" &&
    company.is_published === true &&
    company.marketplace_visible === true &&
    Boolean(company.published_at) &&
    company.is_sample !== true &&
    // Compliance (dual-lane §0.1): only Reg CF founders may appear on any public
    // surface. Non-Reg-CF (Reg D) offerings must never be publicly visible.
    company.offering_type === "reg_cf"
  );
}

const campaignFields =
  "problem, solution, market_opportunity, traction, use_of_funds, risk_disclosures, funding_target, minimum_investment";

async function fetchLatestCampaign(supabase: SupabaseClient<Database>, companyId: string) {
  const { data } = await supabase
    .from("campaigns")
    .select(campaignFields)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function findPublishedCompanyBySlug(supabase: SupabaseClient<Database>, slug: string) {
  const { data: company, error } = await supabase.from("companies").select("*").eq("slug", slug).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (company && isCompanyMarketplaceListed(company as Company)) {
    return company as Company;
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("company_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!campaign?.company_id) {
    return null;
  }

  const { data: companyByCampaign, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", campaign.company_id)
    .maybeSingle();

  if (companyError) {
    throw new Error(companyError.message);
  }

  if (!companyByCampaign || !isCompanyMarketplaceListed(companyByCampaign as Company)) {
    return null;
  }

  return companyByCampaign as Company;
}

export async function listMarketplaceListings(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("review_status", "approved")
    .eq("is_published", true)
    .eq("marketplace_visible", true)
    .eq("is_sample", false)
    // Compliance (dual-lane §0.1): public surfaces are Reg CF only.
    .eq("offering_type", "reg_cf")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const companies = (data as Company[]) ?? [];
  const listings: MarketplaceListing[] = [];

  for (const company of companies) {
    const slug = company.slug ?? (await ensureCompanySlug(supabase, company));
    const campaign = await fetchLatestCampaign(supabase, company.id);
    listings.push(mapCompanyToListing({ ...company, slug }, slug, campaign));
  }

  return listings;
}

export async function getMarketplaceListingBySlug(supabase: SupabaseClient<Database>, slug: string) {
  const company = await findPublishedCompanyBySlug(supabase, slug);

  if (!company) {
    return null;
  }

  const resolvedSlug = company.slug ?? (await ensureCompanySlug(supabase, company));
  const campaign = await fetchLatestCampaign(supabase, company.id);

  return mapCompanyToListing(company, resolvedSlug, campaign);
}

export async function getMarketplaceListingByCompanyId(
  supabase: SupabaseClient<Database>,
  companyId: string,
) {
  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!company || !isCompanyMarketplaceListed(company as Company)) {
    return null;
  }

  const resolvedSlug = company.slug ?? (await ensureCompanySlug(supabase, company as Company));
  const campaign = await fetchLatestCampaign(supabase, company.id);

  return mapCompanyToListing(company as Company, resolvedSlug, campaign);
}

export async function setCompanyMarketplaceVisibility(
  supabase: SupabaseClient<Database>,
  input: {
    companyId: string;
    adminId: string;
    publish: boolean;
  },
) {
  adminDebug({
    scope: "marketplace.setCompanyMarketplaceVisibility",
    action: input.publish ? "publish" : "unpublish",
    userId: input.adminId,
    companyId: input.companyId,
    query: "companies.select(*).eq(id).single()",
  });

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", input.companyId)
    .single();

  if (companyError || !company) {
    return { error: companyError ?? { message: "Company not found." } };
  }

  if (company.review_status !== "approved") {
    return { error: { message: "Company must be approved before marketplace publication." } };
  }

  if (input.publish && (company as Company & { is_sample?: boolean | null }).is_sample === true) {
    return { error: { message: "Sample companies cannot be published to the marketplace." } };
  }

  const now = new Date().toISOString();
  const slug = await ensureCompanySlug(supabase, company as Company);

  adminDebug({
    scope: "marketplace.setCompanyMarketplaceVisibility",
    companyId: input.companyId,
    slug,
    response: {
      review_status: company.review_status,
      is_published: company.is_published,
      marketplace_visible: company.marketplace_visible,
    },
  });

  if (input.publish) {
    const { data: updated, error: updateError } = await supabase
      .from("companies")
      .update({
        is_published: true,
        marketplace_visible: true,
        published_at: now,
        status: "published",
        updated_at: now,
      })
      .eq("id", input.companyId)
      .select("*")
      .single();

    if (updateError) {
      return { error: updateError };
    }

    const campaignResult = await ensurePublishedCampaign(supabase, updated as Company, slug, now);
    adminDebug({
      scope: "marketplace.setCompanyMarketplaceVisibility",
      action: "ensure_campaign",
      companyId: input.companyId,
      slug,
      query: "ensurePublishedCampaign()",
      response: "data" in campaignResult ? campaignResult.data : null,
      error: "error" in campaignResult ? campaignResult.error : null,
    });
    if ("error" in campaignResult && campaignResult.error) {
      return { error: campaignResult.error };
    }

    return { data: updated };
  }

  const { data: updated, error: updateError } = await supabase
    .from("companies")
    .update({
      is_published: false,
      marketplace_visible: false,
      status: "approved",
      updated_at: now,
    })
    .eq("id", input.companyId)
    .select("*")
    .single();

  if (updateError) {
    return { error: updateError };
  }

  await supabase
    .from("campaigns")
    .update({ status: "draft", published_at: null })
    .eq("company_id", input.companyId);

  return { data: updated };
}

export async function ensurePublishedCampaign(
  supabase: SupabaseClient<Database>,
  company: Company,
  slug: string,
  publishedAt: string,
) {
  const campaignSlug = await resolveCampaignSlug(supabase, company.id, slug);
  const campaignPayload = {
    company_id: company.id,
    title: getCompanyTitle(company),
    slug: campaignSlug,
    problem: company.business_description,
    solution: company.business_description,
    market_opportunity: company.industry,
    traction: company.revenue_stage,
    funding_target: company.funding_amount,
    use_of_funds: company.use_of_funds,
    risk_disclosures:
      "This opportunity is for informational purposes only and does not constitute an offer to sell securities.",
    status: "published",
    published_at: publishedAt,
  };

  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  adminDebug({
    scope: "marketplace.ensurePublishedCampaign",
    companyId: company.id,
    slug: campaignSlug,
    query: existing?.id ? "campaigns.update" : "campaigns.insert",
    meta: { companyTitle: getCompanyTitle(company), existingCampaignId: existing?.id ?? null },
  });

  if (existing?.id) {
    const { data, error } = await supabase
      .from("campaigns")
      .update(campaignPayload)
      .eq("id", existing.id)
      .select("id, slug")
      .single();

    if (error) {
      adminDebug({
        scope: "marketplace.ensurePublishedCampaign",
        companyId: company.id,
        slug: campaignSlug,
        query: "campaigns.update",
        error,
      });
      return { error };
    }

    adminDebug({
      scope: "marketplace.ensurePublishedCampaign",
      companyId: company.id,
      slug: data?.slug ?? campaignSlug,
      response: data,
    });
    return { data };
  }

  const { data, error } = await supabase.from("campaigns").insert(campaignPayload).select("id, slug").single();

  if (error) {
    adminDebug({
      scope: "marketplace.ensurePublishedCampaign",
      companyId: company.id,
      slug: campaignSlug,
      query: "campaigns.insert",
      error,
    });
    return { error };
  }

  adminDebug({
    scope: "marketplace.ensurePublishedCampaign",
    companyId: company.id,
    slug: data?.slug ?? campaignSlug,
    response: data,
  });
  return { data };
}

export async function ensureCampaignForListedCompany(
  supabase: SupabaseClient<Database>,
  company: Company,
) {
  const slug = company.slug ?? (await ensureCompanySlug(supabase, company));
  const publishedAt = company.published_at ?? company.approved_at ?? new Date().toISOString();

  return ensurePublishedCampaign(supabase, { ...company, slug }, slug, publishedAt);
}

export function getCompanyStatusBadge(input: {
  review_status: string | null;
  is_published?: boolean | null;
  marketplace_visible?: boolean | null;
  published_at?: string | null;
}) {
  const reviewStatus = input.review_status ?? "pending";

  if (reviewStatus === "rejected") return "Rejected";
  if (reviewStatus === "changes_requested") return "Changes Requested";
  if (reviewStatus === "pending") return "Pending Review";

  if (reviewStatus === "approved") {
    if (input.is_published && input.marketplace_visible) {
      return "Published";
    }
    if (input.published_at && !input.is_published) {
      return "Unpublished";
    }
    return "Approved";
  }

  return reviewStatus
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getCompanyStatusBadgeClass(label: string) {
  switch (label) {
    case "Published":
      return "bg-emerald-100 text-emerald-800";
    case "Approved":
      return "bg-blue-100 text-blue-800";
    case "Unpublished":
      return "bg-slate-200 text-slate-700";
    case "Rejected":
      return "bg-red-100 text-red-800";
    case "Changes Requested":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-amber-50 text-amber-900";
  }
}
