/**
 * Verifies investor Express Interest flow:
 * - service role auto-creates missing campaigns (investors cannot)
 * - investor_interests row can be inserted after campaign exists
 *
 * Run: node scripts/test-investor-express-interest.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey || !anonKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const service = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "company"
  );
}

async function ensurePublishedCampaign(company, slug) {
  const now = new Date().toISOString();
  const payload = {
    company_id: company.id,
    title: company.company_name,
    slug,
    problem: company.business_description,
    solution: company.business_description,
    market_opportunity: company.industry,
    traction: company.revenue_stage,
    funding_target: company.funding_amount,
    use_of_funds: company.use_of_funds,
    risk_disclosures:
      "This opportunity is for informational purposes only and does not constitute an offer to sell securities.",
    status: "published",
    published_at: company.published_at ?? now,
  };

  const { data, error } = await service.from("campaigns").insert(payload).select("id, slug").single();
  return { data, error };
}

async function main() {
  const results = {
    investorFound: false,
    companyFound: false,
    campaignRemoved: false,
    investorCampaignInsertBlocked: null,
    serviceCampaignCreated: false,
    interestRowCreated: false,
    cleanup: false,
    errors: [],
  };

  const { data: investor } = await service
    .from("profiles")
    .select("id, email, role")
    .ilike("role", "investor")
    .limit(1)
    .maybeSingle();

  if (!investor) {
    results.errors.push("No investor profile found.");
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }
  results.investorFound = true;

  const { data: company } = await service
    .from("companies")
    .select("*")
    .eq("review_status", "approved")
    .eq("is_published", true)
    .eq("marketplace_visible", true)
    .not("published_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (!company) {
    results.errors.push("No published marketplace company found.");
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }
  results.companyFound = { id: company.id, slug: company.slug, name: company.company_name };

  const { data: existingCampaigns } = await service
    .from("campaigns")
    .select("id")
    .eq("company_id", company.id);

  const backupCampaigns = existingCampaigns ?? [];
  if (backupCampaigns.length > 0) {
    await service.from("campaigns").delete().eq("company_id", company.id);
    results.campaignRemoved = true;
  }

  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const slug = company.slug ?? slugify(company.company_name);
  const blockedInsert = await anonClient.from("campaigns").insert({
    company_id: company.id,
    title: company.company_name,
    slug,
    status: "published",
  });

  results.investorCampaignInsertBlocked = Boolean(blockedInsert.error);
  if (!blockedInsert.error) {
    results.errors.push("Expected anon campaign insert to fail under RLS, but it succeeded.");
    await service.from("campaigns").delete().eq("company_id", company.id);
  }

  const created = await ensurePublishedCampaign(company, slug);
  if (created.error) {
    results.errors.push(`Service campaign create failed: ${created.error.message}`);
  } else {
    results.serviceCampaignCreated = { id: created.data.id, slug: created.data.slug };
  }

  const testInterestId = crypto.randomUUID();
  const { data: interest, error: interestError } = await service
    .from("investor_interests")
    .insert({
      id: testInterestId,
      investor_id: investor.id,
      company_id: company.id,
      campaign_id: created.data?.id,
      status: "interested",
      message: "express-interest-rls-test",
    })
    .select("id, campaign_id, company_id")
    .single();

  if (interestError) {
    results.errors.push(`investor_interests insert failed: ${interestError.message}`);
  } else {
    results.interestRowCreated = interest;
    await service.from("investor_interests").delete().eq("id", testInterestId);
  }

  if (created.data?.id) {
    await service.from("investor_interests").delete().eq("campaign_id", created.data.id);
    await service.from("campaigns").delete().eq("id", created.data.id);
  }

  if (backupCampaigns.length > 0) {
    const restore = await ensurePublishedCampaign(company, slug);
    results.cleanup = !restore.error;
  } else {
    results.cleanup = true;
  }

  results.passed =
    results.investorFound &&
    results.companyFound &&
    results.investorCampaignInsertBlocked === true &&
    Boolean(results.serviceCampaignCreated) &&
    Boolean(results.interestRowCreated) &&
    results.errors.length === 0;

  console.log(JSON.stringify(results, null, 2));
  process.exit(results.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
