import { detectRiskyPhrases } from "@/lib/compliance/risk-phrases";
import { recordComplianceEvent } from "@/lib/compliance/events";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { OUTREACH_DAILY_LIMIT_MAX } from "@/lib/founder-crm/types";

const QUEUED_OUTREACH_WARNING = 15;
const QUEUED_OUTREACH_CRITICAL = 22;
const MESSAGING_FLAG_WINDOW = 50;

export async function runComplianceScans() {
  const admin = createServiceRoleClient();
  let created = 0;

  const scanners = [
    scanFlaggedSocialDrafts(admin),
    scanRiskyOutreachMessages(admin),
    scanOutreachVolume(admin),
    scanMessagingContent(admin),
    scanTrialAbuse(admin),
    scanInvestorRejections(admin),
    scanMissingOnboarding(admin),
    scanHighRiskCompanies(admin),
  ];

  const results = await Promise.all(scanners);
  for (const result of results) {
    created += result.created;
  }

  return { created };
}

async function scanFlaggedSocialDrafts(admin: ReturnType<typeof createServiceRoleClient>) {
  let created = 0;
  const { data } = await admin
    .from("social_outreach_drafts")
    .select("id, founder_id, company_id, title, compliance_status, draft_type")
    .eq("compliance_status", "flagged")
    .limit(100);

  for (const row of data ?? []) {
    const result = await recordComplianceEvent({
      companyId: row.company_id,
      founderId: row.founder_id,
      eventType: "social_draft_flagged",
      severity: "high",
      source: "social_outreach",
      title: "Flagged social draft",
      description: `Social draft "${row.title}" (${row.draft_type}) contains risky compliance phrases.`,
      sourceId: row.id,
    });
    if (result.created) {
      created += 1;
    }
  }

  return { created };
}

async function scanRiskyOutreachMessages(admin: ReturnType<typeof createServiceRoleClient>) {
  let created = 0;
  const { data: messages } = await admin
    .from("outreach_messages")
    .select("id, subject, body, campaign_id")
    .in("status", ["draft", "queued"])
    .limit(200);

  const campaignIds = [...new Set((messages ?? []).map((row) => row.campaign_id))];
  const { data: campaigns } =
    campaignIds.length > 0
      ? await admin.from("outreach_campaigns").select("id, founder_id, company_id").in("id", campaignIds)
      : { data: [] };
  const campaignMap = new Map((campaigns ?? []).map((row) => [row.id, row]));

  for (const row of messages ?? []) {
    const risky = detectRiskyPhrases(`${row.subject}\n${row.body}`);
    if (risky.length === 0) {
      continue;
    }

    const campaign = campaignMap.get(row.campaign_id);
    const result = await recordComplianceEvent({
      companyId: campaign?.company_id,
      founderId: campaign?.founder_id,
      eventType: "risky_fundraising_language",
      severity: "high",
      source: "outreach_messages",
      title: "Risky fundraising language in outreach",
      description: `Outreach message contains flagged phrases: ${risky.join(", ")}.`,
      sourceId: row.id,
      metadata: { phrases: risky },
    });
    if (result.created) {
      created += 1;
    }
  }

  return { created };
}

async function scanOutreachVolume(admin: ReturnType<typeof createServiceRoleClient>) {
  let created = 0;

  const { data: campaigns } = await admin
    .from("outreach_campaigns")
    .select("id, founder_id, company_id, name, status, audience_count")
    .in("status", ["queued", "active", "draft"]);

  for (const campaign of campaigns ?? []) {
    const { count } = await admin
      .from("outreach_messages")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "queued");

    const queued = count ?? 0;
    if (queued >= QUEUED_OUTREACH_WARNING) {
      const severity = queued >= QUEUED_OUTREACH_CRITICAL ? "critical" : "high";
      const result = await recordComplianceEvent({
        companyId: campaign.company_id,
        founderId: campaign.founder_id,
        eventType: queued >= OUTREACH_DAILY_LIMIT_MAX ? "outreach_abuse" : "excessive_queued_outreach",
        severity,
        source: "outreach_campaigns",
        title: "High outreach queue volume",
        description: `Campaign "${campaign.name}" has ${queued} queued messages (daily limit ${OUTREACH_DAILY_LIMIT_MAX}).`,
        sourceId: campaign.id,
        metadata: { queued, dailyLimit: OUTREACH_DAILY_LIMIT_MAX },
      });
      if (result.created) {
        created += 1;
      }
    }
  }

  const { data: activeCampaigns } = await admin
    .from("outreach_campaigns")
    .select("founder_id")
    .in("status", ["queued", "active"]);

  const byFounder = new Map<string, number>();
  for (const row of activeCampaigns ?? []) {
    byFounder.set(row.founder_id, (byFounder.get(row.founder_id) ?? 0) + 1);
  }

  for (const [founderId, count] of byFounder) {
    if (count > 1) {
      const result = await recordComplianceEvent({
        founderId,
        eventType: "excessive_queued_outreach",
        severity: "medium",
        source: "outreach_campaigns",
        title: "Multiple active outreach campaigns",
        description: `Founder has ${count} active/queued campaigns (platform limit is 1).`,
        sourceId: founderId,
      });
      if (result.created) {
        created += 1;
      }
    }
  }

  return { created };
}

async function scanMessagingContent(admin: ReturnType<typeof createServiceRoleClient>) {
  let created = 0;
  const { data: messages } = await admin
    .from("thread_messages")
    .select("id, thread_id, body")
    .order("created_at", { ascending: false })
    .limit(MESSAGING_FLAG_WINDOW);

  const threadIds = [...new Set((messages ?? []).map((row) => row.thread_id))];
  const { data: threads } =
    threadIds.length > 0
      ? await admin.from("message_threads").select("id, company_id, founder_id, investor_id").in("id", threadIds)
      : { data: [] };
  const threadMap = new Map((threads ?? []).map((row) => [row.id, row]));

  const phraseCounts = new Map<string, number>();

  for (const row of messages ?? []) {
    const risky = detectRiskyPhrases(row.body);
    if (risky.length === 0) {
      continue;
    }

    const thread = threadMap.get(row.thread_id);

    const result = await recordComplianceEvent({
      companyId: thread?.company_id,
      founderId: thread?.founder_id,
      investorId: thread?.investor_id,
      eventType: "messaging_risky_phrase",
      severity: "high",
      source: "thread_messages",
      title: "Risky phrase in messaging",
      description: `Message contains: ${risky.join(", ")}.`,
      sourceId: row.id,
      metadata: { phrases: risky, threadId: row.thread_id },
    });
    if (result.created) {
      created += 1;
    }

    const founderKey = thread?.founder_id ?? "unknown";
    phraseCounts.set(founderKey, (phraseCounts.get(founderKey) ?? 0) + 1);
  }

  for (const [founderId, count] of phraseCounts) {
    if (count >= 2 && founderId !== "unknown") {
      const result = await recordComplianceEvent({
        founderId,
        eventType: "repeated_flagged_messaging",
        severity: "critical",
        source: "thread_messages",
        title: "Repeated flagged messaging",
        description: `${count} recent messages contained risky compliance phrases.`,
        sourceId: `founder:${founderId}`,
      });
      if (result.created) {
        created += 1;
      }
    }
  }

  return { created };
}

async function scanTrialAbuse(admin: ReturnType<typeof createServiceRoleClient>) {
  let created = 0;
  const { data } = await admin
    .from("subscriptions")
    .select("profile_id, plan_type, subscription_status, trial_ends_at")
    .eq("plan_type", "founder_trial");

  const now = Date.now();
  for (const row of data ?? []) {
    const expired =
      row.subscription_status === "expired" ||
      row.subscription_status === "canceled" ||
      (row.trial_ends_at && new Date(row.trial_ends_at).getTime() <= now);

    if (!expired) {
      continue;
    }

    const { count } = await admin
      .from("outreach_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("founder_id", row.profile_id)
      .in("status", ["draft", "queued", "active"]);

    if ((count ?? 0) > 0) {
      const result = await recordComplianceEvent({
        founderId: row.profile_id,
        eventType: "trial_abuse_pattern",
        severity: "medium",
        source: "subscriptions",
        title: "Outreach activity on expired trial",
        description: "Founder with expired trial still has active outreach campaign records.",
        sourceId: row.profile_id,
      });
      if (result.created) {
        created += 1;
      }
    }
  }

  return { created };
}

async function scanInvestorRejections(admin: ReturnType<typeof createServiceRoleClient>) {
  let created = 0;
  const { data } = await admin
    .from("investor_profiles")
    .select("profile_id, approval_status, updated_at")
    .in("approval_status", ["rejected", "changes_requested"])
    .limit(100);

  for (const row of data ?? []) {
    const result = await recordComplianceEvent({
      investorId: row.profile_id,
      eventType: "investor_review_rejection",
      severity: row.approval_status === "rejected" ? "medium" : "low",
      source: "investor_profiles",
      title: `Investor ${row.approval_status}`,
      description: `Investor profile requires staff attention (${row.approval_status}).`,
      sourceId: row.profile_id,
    });
    if (result.created) {
      created += 1;
    }
  }

  return { created };
}

async function scanMissingOnboarding(admin: ReturnType<typeof createServiceRoleClient>) {
  let created = 0;
  const { data } = await admin
    .from("companies")
    .select("id, founder_id, company_name, onboarding_progress_percent, business_description, review_status")
    .limit(200);

  for (const row of data ?? []) {
    const percent = row.onboarding_progress_percent ?? 0;
    const descriptionOk = (row.business_description?.trim().length ?? 0) >= 20;

    if (percent < 40 || !descriptionOk) {
      const result = await recordComplianceEvent({
        companyId: row.id,
        founderId: row.founder_id,
        eventType: "missing_onboarding_data",
        severity: percent < 20 ? "high" : "medium",
        source: "companies",
        title: "Incomplete founder onboarding",
        description: `${row.company_name}: onboarding ${percent}%, description ${descriptionOk ? "ok" : "incomplete"}.`,
        sourceId: row.id,
      });
      if (result.created) {
        created += 1;
      }
    }

    if (row.review_status === "pending" && percent < 60) {
      const result = await recordComplianceEvent({
        companyId: row.id,
        founderId: row.founder_id,
        eventType: "failed_compliance_check",
        severity: "low",
        source: "companies",
        title: "Readiness review pending",
        description: `${row.company_name} is pending review with onboarding at ${percent}%.`,
        sourceId: `${row.id}:pending`,
      });
      if (result.created) {
        created += 1;
      }
    }
  }

  return { created };
}

async function scanHighRiskCompanies(admin: ReturnType<typeof createServiceRoleClient>) {
  let created = 0;

  const { data: companies } = await admin
    .from("companies")
    .select("id, founder_id, company_name, review_status, onboarding_progress_percent")
    .limit(150);

  for (const company of companies ?? []) {
    const [{ count: remediation }, { data: report }, { count: queued }] = await Promise.all([
      admin
        .from("founder_remediation_tasks")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .in("status", ["open", "in_progress"])
        .eq("priority", "high"),
      admin
        .from("diligence_reports")
        .select("readiness_score")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("outreach_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .in("status", ["queued", "active"]),
    ]);

    const readiness = report?.readiness_score ?? null;
    const highRemediation = (remediation ?? 0) > 0;
    const activeOutreach = (queued ?? 0) > 0;
    const lowReadiness = readiness != null && readiness < 50;

    if ((lowReadiness && activeOutreach) || (highRemediation && activeOutreach)) {
      const result = await recordComplianceEvent({
        companyId: company.id,
        founderId: company.founder_id,
        eventType: "high_risk_company",
        severity: lowReadiness ? "critical" : "high",
        source: "compliance_scan",
        title: "High-risk company profile",
        description: `${company.company_name}: readiness ${readiness ?? "—"}, high-priority remediation ${remediation ?? 0}, active outreach ${activeOutreach ? "yes" : "no"}.`,
        sourceId: company.id,
        metadata: { readiness, highRemediation, activeOutreach },
      });
      if (result.created) {
        created += 1;
      }
    }
  }

  return { created };
}
