import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocalIfNeeded() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocalIfNeeded();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
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

async function ensureCompanySlug(company) {
  if (company.slug) return company.slug;

  let candidate = slugify(company.company_name);
  for (let suffix = 0; suffix < 20; suffix += 1) {
    const slug = suffix === 0 ? candidate : `${candidate}-${suffix}`;
    const { data: conflict } = await supabase.from("companies").select("id").eq("slug", slug).maybeSingle();
    if (!conflict || conflict.id === company.id) {
      await supabase.from("companies").update({ slug }).eq("id", company.id);
      return slug;
    }
  }

  const fallback = `${candidate}-${company.id.slice(0, 8)}`;
  await supabase.from("companies").update({ slug: fallback }).eq("id", company.id);
  return fallback;
}

async function resolveCampaignSlug(companyId, preferredSlug) {
  const { data: conflict } = await supabase.from("campaigns").select("id, company_id").eq("slug", preferredSlug).maybeSingle();
  if (!conflict || conflict.company_id === companyId) return preferredSlug;
  return `${preferredSlug}-${companyId.slice(0, 8)}`;
}

async function ensureCampaign(company, slug) {
  const publishedAt = company.published_at ?? company.approved_at ?? new Date().toISOString();
  const campaignSlug = await resolveCampaignSlug(company.id, slug);
  const title = company.company_name?.trim() || "Company listing";
  const payload = {
    company_id: company.id,
    title,
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
    .select("id, slug")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("campaigns").update(payload).eq("id", existing.id);
    if (error) throw new Error(`Update campaign ${existing.id}: ${error.message}`);
    return existing.id;
  }

  const { data, error } = await supabase.from("campaigns").insert(payload).select("id").single();
  if (error) throw new Error(`Insert campaign for ${company.id}: ${error.message}`);
  return data.id;
}

async function main() {
  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .eq("review_status", "approved")
    .eq("is_published", true)
    .eq("marketplace_visible", true)
    .not("published_at", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  let repaired = 0;

  for (const company of companies ?? []) {
    const slug = await ensureCompanySlug(company);
    await ensureCampaign({ ...company, slug }, slug);
    repaired += 1;
    console.log(`Repaired campaign for ${company.company_name} (${slug})`);
  }

  console.log(JSON.stringify({ repairedCompanies: repaired }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
