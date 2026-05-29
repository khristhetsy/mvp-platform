import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkColumns() {
  const columns = [
    "company_name",
    "review_status",
    "approved_at",
    "approved_by",
    "is_published",
    "marketplace_visible",
    "published_at",
    "slug",
  ];

  const missing = [];
  for (const column of columns) {
    const { error } = await supabase.from("companies").select(column).limit(1);
    if (error?.code === "42703") missing.push(column);
  }

  return { ok: missing.length === 0, missing };
}

async function findDuplicateCampaignSlugs() {
  const { data: campaigns, error } = await supabase.from("campaigns").select("id, slug, company_id, status");
  if (error) throw new Error(error.message);

  const bySlug = new Map();
  for (const row of campaigns ?? []) {
    if (!row.slug) continue;
    const list = bySlug.get(row.slug) ?? [];
    list.push(row);
    bySlug.set(row.slug, list);
  }

  return [...bySlug.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([slug, rows]) => ({ slug, count: rows.length, rows }));
}

async function findSlugMismatches() {
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, company_name, slug, review_status, is_published, marketplace_visible, published_at");

  if (error) throw new Error(error.message);

  const mismatches = [];

  for (const company of companies ?? []) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, slug, status")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const listed =
      company.review_status === "approved" &&
      company.is_published &&
      company.marketplace_visible &&
      company.published_at;

    mismatches.push({
      companyId: company.id,
      companyName: company.company_name,
      companySlug: company.slug,
      listed,
      campaignId: campaign?.id ?? null,
      campaignSlug: campaign?.slug ?? null,
      campaignStatus: campaign?.status ?? null,
      slugMismatch: Boolean(company.slug && campaign?.slug && company.slug !== campaign.slug),
      missingCampaign: listed && !campaign,
    });
  }

  return mismatches;
}

async function main() {
  const [columns, duplicateSlugs, slugReport] = await Promise.all([
    checkColumns(),
    findDuplicateCampaignSlugs(),
    findSlugMismatches(),
  ]);

  const publishedWithoutCampaign = slugReport.filter((row) => row.missingCampaign);
  const slugConflicts = slugReport.filter((row) => row.slugMismatch);

  console.log(
    JSON.stringify(
      {
        columns,
        duplicateCampaignSlugs: duplicateSlugs,
        publishedWithoutCampaign,
        slugConflicts,
        companies: slugReport,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
