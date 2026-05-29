/**
 * Server-side admin button flow test (service role).
 * Run: node scripts/test-admin-button-flow.mjs
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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_ID = "95db074b-4d10-42f1-b672-0008ee6b00f3";

async function createPendingCompany(founderId) {
  const { data, error } = await supabase
    .from("companies")
    .insert({
      founder_id: founderId,
      company_name: `Debug Test ${Date.now()}`,
      status: "in_review",
      review_status: "pending",
      business_description: "Temporary company for admin button flow debug.",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function testSaveFeedback(companyId) {
  const { data: company } = await supabase.from("companies").select("founder_id").eq("id", companyId).single();
  const { error } = await supabase.from("admin_reviews").insert({
    company_id: companyId,
    founder_id: company.founder_id,
    reviewed_by: ADMIN_ID,
    status: "pending",
    feedback: "Debug feedback save",
    notes: "Debug feedback save",
  });
  return error?.message || "ok";
}

async function testApprove(companyId) {
  const now = new Date().toISOString();
  const { data: updated, error: approveError } = await supabase
    .from("companies")
    .update({ review_status: "approved", status: "approved", approved_at: now, approved_by: ADMIN_ID, updated_at: now })
    .eq("id", companyId)
    .select("*")
    .single();
  if (approveError) return { step: "approve", error: approveError.message };

  const slug =
    updated.slug ||
    updated.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);

  const { error: campaignError } = await supabase.from("campaigns").insert({
    company_id: companyId,
    title: updated.company_name,
    slug,
    problem: updated.business_description,
    solution: updated.business_description,
    status: "published",
    published_at: now,
  });
  if (campaignError) return { step: "campaign", error: campaignError.message };

  const { error: publishError } = await supabase
    .from("companies")
    .update({ is_published: true, marketplace_visible: true, published_at: now, status: "published" })
    .eq("id", companyId);
  if (publishError) return { step: "publish", error: publishError.message };

  return { step: "ok" };
}

async function testUnpublish(companyId) {
  const { error } = await supabase
    .from("companies")
    .update({ is_published: false, marketplace_visible: false, status: "approved" })
    .eq("id", companyId);
  return error?.message || "ok";
}

async function testPublish(companyId) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("companies")
    .update({ is_published: true, marketplace_visible: true, published_at: now, status: "published" })
    .eq("id", companyId);
  return error?.message || "ok";
}

async function testReject(companyId) {
  const { error } = await supabase
    .from("companies")
    .update({ review_status: "rejected", status: "rejected", is_published: false, marketplace_visible: false, published_at: null })
    .eq("id", companyId);
  return error?.message || "ok";
}

async function main() {
  const { data: founder } = await supabase.from("profiles").select("id").ilike("role", "founder").limit(1).single();
  const company = await createPendingCompany(founder.id);

  const results = {
    companyId: company.id,
    saveFeedback: await testSaveFeedback(company.id),
    approve: await testApprove(company.id),
    unpublish: await testUnpublish(company.id),
    publish: await testPublish(company.id),
  };

  await supabase.from("companies").update({ review_status: "pending", status: "in_review" }).eq("id", company.id);
  results.reject = await testReject(company.id);

  await supabase.from("companies").update({ review_status: "pending", status: "in_review" }).eq("id", company.id);
  const { error: changesError } = await supabase
    .from("companies")
    .update({ review_status: "changes_requested", status: "changes_requested" })
    .eq("id", company.id);
  results.requestChanges = changesError?.message || "ok";

  await supabase.from("companies").delete().eq("id", company.id);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
