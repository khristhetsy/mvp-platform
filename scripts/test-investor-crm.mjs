/**
 * Verifies Phase 1 investor CRM logging via service role (same path as API routes).
 * Run after applying migration 0012_investor_crm.sql:
 *   node scripts/test-investor-crm.mjs
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

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const service = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACTIVITY_PIPELINE_STAGE = {
  saved_deal: "interested",
  expressed_interest: "interested",
  requested_intro: "meeting_requested",
  follow_up_requested: "follow_up",
};

async function recordCrmActivity(input) {
  const now = new Date().toISOString();
  const { data: activity, error: activityError } = await service
    .from("investor_activity")
    .insert({
      investor_id: input.investorId,
      company_id: input.companyId,
      campaign_id: input.campaignId ?? null,
      activity_type: input.activityType,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (activityError) return { error: activityError };

  const stage = ACTIVITY_PIPELINE_STAGE[input.activityType];
  const { data: existing } = await service
    .from("investor_pipeline")
    .select("id")
    .eq("investor_id", input.investorId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (existing?.id) {
    const { error: pipelineError } = await service
      .from("investor_pipeline")
      .update({ stage, last_activity_at: now, updated_at: now, campaign_id: input.campaignId ?? null })
      .eq("id", existing.id);
    if (pipelineError) return { error: pipelineError };
  } else {
    const { error: pipelineError } = await service.from("investor_pipeline").insert({
      investor_id: input.investorId,
      company_id: input.companyId,
      campaign_id: input.campaignId ?? null,
      stage,
      last_activity_at: now,
      updated_at: now,
    });
    if (pipelineError) return { error: pipelineError };
  }

  return { data: { activityId: activity.id } };
}

async function main() {
  const results = { errors: [], checks: {} };

  const { data: investor } = await service
    .from("profiles")
    .select("id")
    .ilike("role", "investor")
    .limit(1)
    .maybeSingle();

  const { data: company } = await service
    .from("companies")
    .select("id")
    .eq("review_status", "approved")
    .limit(1)
    .maybeSingle();

  if (!investor || !company) {
    console.error("Need at least one investor profile and approved company.");
    process.exit(1);
  }

  const testPrefix = `crm-test-${Date.now()}`;
  const activityTypes = ["saved_deal", "expressed_interest", "requested_intro"];

  for (const activityType of activityTypes) {
    const logged = await recordCrmActivity({
      investorId: investor.id,
      companyId: company.id,
      activityType,
      metadata: { test: testPrefix },
    });
    if (logged.error) {
      results.errors.push(`${activityType}: ${logged.error.message}`);
    }
  }

  const { data: activities } = await service
    .from("investor_activity")
    .select("id, activity_type")
    .eq("investor_id", investor.id)
    .eq("company_id", company.id)
    .contains("metadata", { test: testPrefix });

  results.checks.activityRows = activities?.length ?? 0;

  const { data: pipeline } = await service
    .from("investor_pipeline")
    .select("stage")
    .eq("investor_id", investor.id)
    .eq("company_id", company.id)
    .maybeSingle();

  results.checks.pipelineStage = pipeline?.stage ?? null;

  if (activities?.length) {
    await service
      .from("investor_activity")
      .delete()
      .in(
        "id",
        activities.map((row) => row.id),
      );
  }
  await service.from("investor_pipeline").delete().eq("investor_id", investor.id).eq("company_id", company.id);

  results.passed =
    results.errors.length === 0 &&
    results.checks.activityRows === 3 &&
    results.checks.pipelineStage === "meeting_requested";

  console.log(JSON.stringify(results, null, 2));
  process.exit(results.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
