import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const ADMIN_REPORT_TYPES = [
  "compliance",
  "founder_readiness",
  "investor_activity",
  "outreach_activity",
  "messaging_meetings",
  "subscription_upgrade",
  "due_diligence",
] as const;

export type AdminReportType = (typeof ADMIN_REPORT_TYPES)[number];

export type AdminReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  companyId?: string;
  founderId?: string;
  investorId?: string;
  severity?: "low" | "medium" | "high" | "critical";
  reviewStatus?: string;
};

export type AdminReportOptions = {
  reportType: AdminReportType;
  filters?: AdminReportFilters;
  preview?: boolean;
};

export type AdminReportPayload = {
  meta: {
    reportType: AdminReportType;
    generatedAt: string;
    preview: boolean;
    filters: AdminReportFilters;
    privacyNotice: string;
  };
  summary: Record<string, number | string | boolean | null>;
  sections: Record<string, Record<string, unknown>[]>;
};

const PREVIEW_ROW_LIMIT = 25;
const EXPORT_ROW_LIMIT = 2000;

const PRIVACY_NOTICE =
  "Internal staff report. Excludes OAuth tokens, encrypted credentials, and private founder contact PII (email/phone).";

function inDateRange(
  value: string | null | undefined,
  filters: AdminReportFilters,
): boolean {
  if (!value) {
    return true;
  }
  const ts = new Date(value).getTime();
  if (filters.dateFrom && ts < new Date(filters.dateFrom).getTime()) {
    return false;
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    if (ts > end.getTime()) {
      return false;
    }
  }
  return true;
}

function limitRows<T>(rows: T[], preview: boolean): T[] {
  const max = preview ? PREVIEW_ROW_LIMIT : EXPORT_ROW_LIMIT;
  return rows.slice(0, max);
}

function sanitizeProfile(row: {
  id: string;
  role?: string | null;
  email?: string | null;
  full_name?: string | null;
  created_at?: string;
}) {
  return {
    id: row.id,
    role: row.role ?? null,
    email: row.email ?? null,
    full_name: row.full_name ?? null,
    created_at: row.created_at ?? null,
  };
}

function sanitizeCompany(row: {
  id: string;
  founder_id: string;
  company_name: string;
  industry?: string | null;
  country?: string | null;
  review_status?: string | null;
  onboarding_progress_percent?: number | null;
  onboarding_completed_at?: string | null;
  is_published?: boolean;
  marketplace_visible?: boolean;
  created_at?: string;
  updated_at?: string;
}) {
  return {
    id: row.id,
    founder_id: row.founder_id,
    company_name: row.company_name,
    industry: row.industry ?? null,
    country: row.country ?? null,
    review_status: row.review_status ?? null,
    onboarding_progress_percent: row.onboarding_progress_percent ?? null,
    onboarding_completed_at: row.onboarding_completed_at ?? null,
    is_published: row.is_published ?? false,
    marketplace_visible: row.marketplace_visible ?? false,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function sanitizeSocialDraft(row: {
  id: string;
  founder_id: string;
  company_id: string;
  campaign_id: string | null;
  draft_type: string;
  platform: string;
  title: string;
  status: string;
  compliance_status: string;
  body?: string;
  copied_at: string | null;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    founder_id: row.founder_id,
    company_id: row.company_id,
    campaign_id: row.campaign_id,
    draft_type: row.draft_type,
    platform: row.platform,
    title: row.title,
    status: row.status,
    compliance_status: row.compliance_status,
    body_length: row.body?.length ?? 0,
    copied_at: row.copied_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function sanitizeOutreachMessage(row: {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: string;
  subject?: string;
  body?: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}) {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    contact_id: row.contact_id,
    status: row.status,
    subject_length: row.subject?.length ?? 0,
    body_length: row.body?.length ?? 0,
    scheduled_at: row.scheduled_at,
    sent_at: row.sent_at,
    created_at: row.created_at,
  };
}

function sanitizeThreadMessage(row: {
  id: string;
  thread_id: string;
  sender_id: string;
  message_type: string;
  body?: string;
  created_at: string;
  read_at: string | null;
}) {
  return {
    id: row.id,
    thread_id: row.thread_id,
    sender_id: row.sender_id,
    message_type: row.message_type,
    body_length: row.body?.length ?? 0,
    created_at: row.created_at,
    read_at: row.read_at,
  };
}

function sanitizeNotification(row: {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}) {
  return {
    id: row.id,
    recipient_user_id: row.recipient_user_id,
    actor_user_id: row.actor_user_id,
    type: row.type,
    title: row.title,
    message_preview: row.message.slice(0, 200),
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    is_read: row.is_read,
    created_at: row.created_at,
  };
}

function sanitizeDiligenceReport(row: {
  id: string;
  company_id: string;
  readiness_score: number | null;
  created_at: string;
  risk_flags?: unknown;
  missing_documents?: unknown;
}) {
  const riskFlags = Array.isArray(row.risk_flags) ? row.risk_flags : [];
  const missingDocs = Array.isArray(row.missing_documents) ? row.missing_documents : [];
  return {
    id: row.id,
    company_id: row.company_id,
    readiness_score: row.readiness_score,
    risk_flag_count: riskFlags.length,
    missing_document_count: missingDocs.length,
    created_at: row.created_at,
  };
}

export async function generateAdminReport(
  admin: SupabaseClient<Database>,
  options: AdminReportOptions,
): Promise<AdminReportPayload> {
  const filters = options.filters ?? {};
  const preview = options.preview ?? false;
  const generatedAt = new Date().toISOString();

  switch (options.reportType) {
    case "compliance":
      return generateComplianceReport(admin, filters, preview, generatedAt);
    case "founder_readiness":
      return generateFounderReadinessReport(admin, filters, preview, generatedAt);
    case "investor_activity":
      return generateInvestorActivityReport(admin, filters, preview, generatedAt);
    case "outreach_activity":
      return generateOutreachActivityReport(admin, filters, preview, generatedAt);
    case "messaging_meetings":
      return generateMessagingMeetingsReport(admin, filters, preview, generatedAt);
    case "subscription_upgrade":
      return generateSubscriptionUpgradeReport(admin, filters, preview, generatedAt);
    case "due_diligence":
      return generateDueDiligenceReport(admin, filters, preview, generatedAt);
    default:
      return {
        meta: {
          reportType: options.reportType,
          generatedAt,
          preview,
          filters,
          privacyNotice: PRIVACY_NOTICE,
        },
        summary: { error: "Unknown report type." },
        sections: {},
      };
  }
}

async function generateComplianceReport(
  admin: SupabaseClient<Database>,
  filters: AdminReportFilters,
  preview: boolean,
  generatedAt: string,
): Promise<AdminReportPayload> {
  let query = admin.from("compliance_events").select("*");
  if (filters.companyId) query = query.eq("company_id", filters.companyId);
  if (filters.founderId) query = query.eq("founder_id", filters.founderId);
  if (filters.investorId) query = query.eq("investor_id", filters.investorId);
  if (filters.severity) query = query.eq("severity", filters.severity);

  const { data } = await query.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT);
  const events = limitRows(
    (data ?? []).filter((row) => inDateRange(row.created_at, filters)),
    preview,
  );

  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const event of events) {
    bySeverity[event.severity] = (bySeverity[event.severity] ?? 0) + 1;
    byStatus[event.status] = (byStatus[event.status] ?? 0) + 1;
  }

  return {
    meta: {
      reportType: "compliance",
      generatedAt,
      preview,
      filters,
      privacyNotice: PRIVACY_NOTICE,
    },
    summary: {
      totalEvents: events.length,
      openEvents: events.filter((e) => e.status === "open").length,
      criticalEvents: events.filter((e) => e.severity === "critical").length,
      bySeverity: JSON.stringify(bySeverity),
      byStatus: JSON.stringify(byStatus),
    },
    sections: {
      compliance_events: events.map((row) => ({
        id: row.id,
        company_id: row.company_id,
        founder_id: row.founder_id,
        investor_id: row.investor_id,
        event_type: row.event_type,
        severity: row.severity,
        source: row.source,
        title: row.title,
        description: row.description,
        status: row.status,
        reviewed_by: row.reviewed_by,
        reviewed_at: row.reviewed_at,
        created_at: row.created_at,
      })),
    },
  };
}

async function generateFounderReadinessReport(
  admin: SupabaseClient<Database>,
  filters: AdminReportFilters,
  preview: boolean,
  generatedAt: string,
): Promise<AdminReportPayload> {
  let companiesQuery = admin
    .from("companies")
    .select(
      "id, founder_id, company_name, industry, country, review_status, onboarding_progress_percent, onboarding_completed_at, is_published, marketplace_visible, created_at, updated_at",
    );
  if (filters.companyId) companiesQuery = companiesQuery.eq("id", filters.companyId);
  if (filters.founderId) companiesQuery = companiesQuery.eq("founder_id", filters.founderId);

  const [companiesRes, diligenceRes, remediationRes, learningRes] = await Promise.all([
    companiesQuery.order("updated_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    filters.companyId
      ? admin.from("diligence_reports").select("*").eq("company_id", filters.companyId)
      : admin.from("diligence_reports").select("*").limit(EXPORT_ROW_LIMIT),
    filters.companyId
      ? admin.from("founder_remediation_tasks").select("*").eq("company_id", filters.companyId)
      : filters.founderId
        ? admin.from("founder_remediation_tasks").select("*").eq("founder_id", filters.founderId)
        : admin.from("founder_remediation_tasks").select("*").limit(EXPORT_ROW_LIMIT),
    filters.companyId
      ? admin.from("learning_progress").select("*").eq("company_id", filters.companyId)
      : filters.founderId
        ? admin.from("learning_progress").select("*").eq("founder_id", filters.founderId)
        : admin.from("learning_progress").select("*").limit(EXPORT_ROW_LIMIT),
  ]);

  const companies = limitRows(
    (companiesRes.data ?? [])
      .filter((row) => inDateRange(row.created_at, filters))
      .map(sanitizeCompany),
    preview,
  );
  const diligence = limitRows(
    (diligenceRes.data ?? [])
      .filter((row) => inDateRange(row.created_at, filters))
      .map(sanitizeDiligenceReport),
    preview,
  );
  const remediation = limitRows(
    (remediationRes.data ?? []).filter((row) => inDateRange(row.created_at, filters)),
    preview,
  );
  const learning = limitRows(
    (learningRes.data ?? []).filter((row) =>
      inDateRange(row.last_viewed_at ?? row.started_at ?? null, filters),
    ),
    preview,
  );

  const avgOnboarding =
    companies.length > 0
      ? Math.round(
          companies.reduce((sum, c) => sum + (c.onboarding_progress_percent ?? 0), 0) / companies.length,
        )
      : 0;

  return {
    meta: {
      reportType: "founder_readiness",
      generatedAt,
      preview,
      filters,
      privacyNotice: PRIVACY_NOTICE,
    },
    summary: {
      companies: companies.length,
      diligenceReports: diligence.length,
      remediationTasks: remediation.length,
      learningProgressRows: learning.length,
      averageOnboardingPercent: avgOnboarding,
      avgReadinessScore:
        diligence.length > 0
          ? Math.round(
              diligence.reduce((sum, r) => sum + (r.readiness_score ?? 0), 0) / diligence.length,
            )
          : null,
    },
    sections: {
      companies,
      diligence_reports: diligence,
      founder_remediation_tasks: remediation,
      learning_progress: learning,
    },
  };
}

async function generateInvestorActivityReport(
  admin: SupabaseClient<Database>,
  filters: AdminReportFilters,
  preview: boolean,
  generatedAt: string,
): Promise<AdminReportPayload> {
  let interestsQuery = admin.from("investor_interests").select("*");
  let activityQuery = admin.from("investor_activity").select("*");
  let profilesQuery = admin.from("investor_profiles").select("*");

  if (filters.companyId) {
    interestsQuery = interestsQuery.eq("company_id", filters.companyId);
    activityQuery = activityQuery.eq("company_id", filters.companyId);
  }
  if (filters.investorId) {
    interestsQuery = interestsQuery.eq("investor_id", filters.investorId);
    activityQuery = activityQuery.eq("investor_id", filters.investorId);
    profilesQuery = profilesQuery.eq("profile_id", filters.investorId);
  }

  const [interestsRes, activityRes, profilesRes] = await Promise.all([
    interestsQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    activityQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    profilesQuery.order("updated_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
  ]);

  const interests = limitRows(
    (interestsRes.data ?? [])
      .filter((row) => inDateRange(row.created_at, filters))
      .map((row) => ({
        id: row.id,
        investor_id: row.investor_id,
        company_id: row.company_id,
        campaign_id: row.campaign_id,
        interest_amount: row.interest_amount,
        pledge_amount: row.pledge_amount,
        pledge_currency: row.pledge_currency,
        status: row.status,
        message_length: row.message?.length ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    preview,
  );
  const activity = limitRows(
    (activityRes.data ?? [])
      .filter((row) => inDateRange(row.created_at, filters))
      .map((row) => ({
        id: row.id,
        investor_id: row.investor_id,
        company_id: row.company_id,
        campaign_id: row.campaign_id,
        activity_type: row.activity_type,
        metadata: row.metadata,
        created_at: row.created_at,
      })),
    preview,
  );
  const profiles = limitRows(
    (profilesRes.data ?? [])
      .filter((row) => inDateRange(row.submitted_at ?? row.updated_at, filters))
      .map((row) => ({
        id: row.id,
        profile_id: row.profile_id,
        firm_name: row.firm_name,
        investor_type: row.investor_type,
        approval_status: row.approval_status,
        submitted_at: row.submitted_at,
        approved_at: row.approved_at,
        accredited_status: row.accredited_status,
      })),
    preview,
  );

  return {
    meta: {
      reportType: "investor_activity",
      generatedAt,
      preview,
      filters,
      privacyNotice: PRIVACY_NOTICE,
    },
    summary: {
      interests: interests.length,
      activityEvents: activity.length,
      investorProfiles: profiles.length,
      approvedProfiles: profiles.filter((p) => p.approval_status === "approved").length,
    },
    sections: {
      investor_interests: interests,
      investor_activity: activity,
      investor_profiles: profiles,
    },
  };
}

async function generateOutreachActivityReport(
  admin: SupabaseClient<Database>,
  filters: AdminReportFilters,
  preview: boolean,
  generatedAt: string,
): Promise<AdminReportPayload> {
  let campaignsQuery = admin.from("outreach_campaigns").select("*");
  let draftsQuery = admin.from("social_outreach_drafts").select("*");
  let targetsQuery = admin.from("founder_outreach_targets").select("*");
  let messagesQuery = admin.from("outreach_messages").select("*");

  if (filters.companyId) {
    campaignsQuery = campaignsQuery.eq("company_id", filters.companyId);
    draftsQuery = draftsQuery.eq("company_id", filters.companyId);
    targetsQuery = targetsQuery.eq("company_id", filters.companyId);
  }
  if (filters.founderId) {
    campaignsQuery = campaignsQuery.eq("founder_id", filters.founderId);
    draftsQuery = draftsQuery.eq("founder_id", filters.founderId);
    targetsQuery = targetsQuery.eq("founder_id", filters.founderId);
  }

  const [campaignsRes, draftsRes, targetsRes, messagesRes, contactCountRes] = await Promise.all([
    campaignsQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    draftsQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    targetsQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    messagesQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    filters.companyId
      ? admin
          .from("founder_investor_contacts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", filters.companyId)
      : admin.from("founder_investor_contacts").select("id", { count: "exact", head: true }),
  ]);

  const campaigns = limitRows(
    (campaignsRes.data ?? []).filter((row) => inDateRange(row.created_at, filters)),
    preview,
  );
  const drafts = limitRows(
    (draftsRes.data ?? [])
      .filter((row) => inDateRange(row.created_at, filters))
      .map(sanitizeSocialDraft),
    preview,
  );
  const targets = limitRows(
    (targetsRes.data ?? []).filter((row) => inDateRange(row.created_at, filters)),
    preview,
  );
  const messages = limitRows(
    (messagesRes.data ?? [])
      .filter((row) => inDateRange(row.created_at, filters))
      .map(sanitizeOutreachMessage),
    preview,
  );

  return {
    meta: {
      reportType: "outreach_activity",
      generatedAt,
      preview,
      filters,
      privacyNotice: PRIVACY_NOTICE,
    },
    summary: {
      campaigns: campaigns.length,
      socialDrafts: drafts.length,
      flaggedSocialDrafts: drafts.filter((d) => d.compliance_status === "flagged").length,
      outreachTargets: targets.length,
      outreachMessages: messages.length,
      privateContactCount: contactCountRes.count ?? 0,
      note: "Private contact PII excluded from export rows.",
    },
    sections: {
      outreach_campaigns: campaigns,
      social_outreach_drafts: drafts,
      founder_outreach_targets: targets,
      outreach_messages: messages,
    },
  };
}

async function generateMessagingMeetingsReport(
  admin: SupabaseClient<Database>,
  filters: AdminReportFilters,
  preview: boolean,
  generatedAt: string,
): Promise<AdminReportPayload> {
  let threadsQuery = admin.from("message_threads").select("*");
  let meetingsQuery = admin.from("thread_meetings").select("*");
  let messagesQuery = admin.from("thread_messages").select("*");
  let notificationsQuery = admin.from("notifications").select("*");

  if (filters.companyId) {
    threadsQuery = threadsQuery.eq("company_id", filters.companyId);
    meetingsQuery = meetingsQuery.eq("company_id", filters.companyId);
  }
  if (filters.founderId) {
    threadsQuery = threadsQuery.eq("founder_id", filters.founderId);
    meetingsQuery = meetingsQuery.eq("founder_id", filters.founderId);
  }
  if (filters.investorId) {
    threadsQuery = threadsQuery.eq("investor_id", filters.investorId);
    meetingsQuery = meetingsQuery.eq("investor_id", filters.investorId);
  }

  const [threadsRes, meetingsRes, messagesRes, notificationsRes] = await Promise.all([
    threadsQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    meetingsQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    messagesQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    notificationsQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
  ]);

  const threads = limitRows(
    (threadsRes.data ?? []).filter((row) => inDateRange(row.created_at, filters)),
    preview,
  );
  const meetings = limitRows(
    (meetingsRes.data ?? [])
      .filter((row) => inDateRange(row.created_at, filters))
      .map((row) => ({
        id: row.id,
        thread_id: row.thread_id,
        company_id: row.company_id,
        founder_id: row.founder_id,
        investor_id: row.investor_id,
        status: row.status,
        proposed_start_time: row.proposed_start_time,
        proposed_end_time: row.proposed_end_time,
        timezone: row.timezone,
        meeting_title: row.meeting_title,
        external_calendar_provider: row.external_calendar_provider,
        external_calendar_event_id: row.external_calendar_event_id
          ? "[redacted]"
          : null,
        calendar_host_user_id: row.calendar_host_user_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    preview,
  );
  const messages = limitRows(
    (messagesRes.data ?? [])
      .filter((row) => inDateRange(row.created_at, filters))
      .map(sanitizeThreadMessage),
    preview,
  );
  const notifications = limitRows(
    (notificationsRes.data ?? [])
      .filter((row) => inDateRange(row.created_at, filters))
      .map(sanitizeNotification),
    preview,
  );

  return {
    meta: {
      reportType: "messaging_meetings",
      generatedAt,
      preview,
      filters,
      privacyNotice: PRIVACY_NOTICE,
    },
    summary: {
      messageThreads: threads.length,
      meetings: meetings.length,
      threadMessages: messages.length,
      notifications: notifications.length,
      scheduledMeetings: meetings.filter((m) => m.status === "scheduled").length,
    },
    sections: {
      message_threads: threads,
      thread_meetings: meetings,
      thread_messages: messages,
      notifications,
    },
  };
}

async function generateSubscriptionUpgradeReport(
  admin: SupabaseClient<Database>,
  filters: AdminReportFilters,
  preview: boolean,
  generatedAt: string,
): Promise<AdminReportPayload> {
  let subsQuery = admin.from("subscriptions").select("*");
  let upgradesQuery = admin.from("upgrade_requests").select("*");

  if (filters.founderId) {
    subsQuery = subsQuery.eq("profile_id", filters.founderId);
    upgradesQuery = upgradesQuery.eq("profile_id", filters.founderId);
  }

  const [subsRes, upgradesRes, profilesRes] = await Promise.all([
    subsQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    upgradesQuery.order("created_at", { ascending: false }).limit(EXPORT_ROW_LIMIT),
    admin
      .from("profiles")
      .select("id, role, email, full_name, created_at")
      .in("role", ["founder", "investor", "admin", "analyst"])
      .limit(500),
  ]);

  const subscriptions = limitRows(
    (subsRes.data ?? []).filter((row) => inDateRange(row.created_at, filters)),
    preview,
  );
  const upgradeRequests = limitRows(
    (upgradesRes.data ?? []).filter((row) => inDateRange(row.created_at, filters)),
    preview,
  );
  const profiles = limitRows(
    (profilesRes.data ?? []).filter((row) => inDateRange(row.created_at, filters)).map(sanitizeProfile),
    preview,
  );

  const planCounts: Record<string, number> = {};
  for (const sub of subscriptions) {
    planCounts[sub.plan_type] = (planCounts[sub.plan_type] ?? 0) + 1;
  }

  return {
    meta: {
      reportType: "subscription_upgrade",
      generatedAt,
      preview,
      filters,
      privacyNotice: PRIVACY_NOTICE,
    },
    summary: {
      subscriptions: subscriptions.length,
      upgradeRequests: upgradeRequests.length,
      pendingUpgrades: upgradeRequests.filter((r) => r.status === "pending").length,
      profileSnapshots: profiles.length,
      planDistribution: JSON.stringify(planCounts),
    },
    sections: {
      subscriptions,
      upgrade_requests: upgradeRequests,
      profiles,
    },
  };
}

function resolveOnboardingMilestone(
  stepState: Record<string, unknown> | null | undefined,
): string | null {
  if (!stepState || typeof stepState !== "object") {
    return null;
  }
  if (typeof stepState.current_step === "string") {
    return stepState.current_step;
  }
  const completed = Object.entries(stepState)
    .filter(([key, value]) => key !== "current_step" && value === true)
    .map(([key]) => key);
  return completed.length > 0 ? completed[completed.length - 1] : null;
}

const FLAGGED_COMPLIANCE_EVENT_TYPES = new Set([
  "social_draft_flagged",
  "risky_fundraising_language",
  "messaging_risky_phrase",
  "repeated_flagged_messaging",
  "outreach_abuse",
  "excessive_queued_outreach",
  "outreach_without_readiness",
]);

async function generateDueDiligenceReport(
  admin: SupabaseClient<Database>,
  filters: AdminReportFilters,
  preview: boolean,
  generatedAt: string,
): Promise<AdminReportPayload> {
  let companiesQuery = admin
    .from("companies")
    .select(
      "id, founder_id, company_name, industry, country, state, revenue_stage, funding_amount, review_status, onboarding_progress_percent, onboarding_completed_at, onboarding_step_state, is_published, marketplace_visible, published_at, created_at, updated_at",
    );

  if (filters.companyId) {
    companiesQuery = companiesQuery.eq("id", filters.companyId);
  }
  if (filters.founderId) {
    companiesQuery = companiesQuery.eq("founder_id", filters.founderId);
  }
  if (filters.reviewStatus) {
    companiesQuery = companiesQuery.eq("review_status", filters.reviewStatus);
  }

  const { data: companyRows } = await companiesQuery
    .order("updated_at", { ascending: false })
    .limit(EXPORT_ROW_LIMIT);

  const companies = (companyRows ?? []).filter((row) =>
    inDateRange(row.updated_at ?? row.created_at, filters),
  );

  const companyIds = companies.map((c) => c.id);
  if (companyIds.length === 0) {
    return {
      meta: {
        reportType: "due_diligence",
        generatedAt,
        preview,
        filters,
        privacyNotice: PRIVACY_NOTICE,
      },
      summary: {
        companiesIncluded: 0,
        averageReadinessScore: null,
        companiesWithOpenCompliance: 0,
      },
      sections: {
        company_diligence: [],
        top_risk_companies: [],
        readiness_distribution: [],
      },
    };
  }

  const [
    documentsRes,
    diligenceRes,
    remediationRes,
    adminReviewsRes,
    complianceRes,
    interestsRes,
    introRes,
    threadsRes,
    meetingsRes,
    learningRes,
  ] = await Promise.all([
    admin
      .from("documents")
      .select("id, company_id, document_type, status, is_approved, created_at")
      .in("company_id", companyIds),
    admin
      .from("diligence_reports")
      .select("id, company_id, readiness_score, missing_documents, risk_flags, created_at")
      .in("company_id", companyIds)
      .order("created_at", { ascending: false }),
    admin
      .from("founder_remediation_tasks")
      .select("id, company_id, category, priority, status, title, created_at")
      .in("company_id", companyIds),
    admin
      .from("admin_reviews")
      .select("id, company_id, status, feedback, notes, requested_changes, created_at, updated_at")
      .in("company_id", companyIds)
      .order("updated_at", { ascending: false }),
    (() => {
      let q = admin.from("compliance_events").select("*").in("company_id", companyIds);
      if (filters.severity) {
        q = q.eq("severity", filters.severity);
      }
      return q.order("created_at", { ascending: false });
    })(),
    admin
      .from("investor_interests")
      .select("id, company_id, pledge_amount, interest_amount, status, created_at")
      .in("company_id", companyIds),
    admin
      .from("intro_requests")
      .select("id, company_id, status, created_at")
      .in("company_id", companyIds),
    admin.from("message_threads").select("id, company_id").in("company_id", companyIds),
    admin
      .from("thread_meetings")
      .select("id, company_id, status")
      .in("company_id", companyIds),
    admin
      .from("learning_progress")
      .select("id, company_id, status, percent_complete, completed_at, module_id")
      .in("company_id", companyIds),
  ]);

  const documents = (documentsRes.data ?? []).filter((row) => inDateRange(row.created_at, filters));
  const diligenceReports = (diligenceRes.data ?? []).filter((row) =>
    inDateRange(row.created_at, filters),
  );
  const remediationTasks = (remediationRes.data ?? []).filter((row) =>
    inDateRange(row.created_at, filters),
  );
  const adminReviews = adminReviewsRes.data ?? [];
  const complianceEvents = (complianceRes.data ?? []).filter((row) =>
    inDateRange(row.created_at, filters),
  );
  const interests = (interestsRes.data ?? []).filter((row) => inDateRange(row.created_at, filters));
  const introRequests = (introRes.data ?? []).filter((row) => inDateRange(row.created_at, filters));
  const threads = threadsRes.data ?? [];
  const meetings = meetingsRes.data ?? [];
  const learningRows = learningRes.data ?? [];

  const documentsByCompany = groupByCompany(documents);
  const diligenceByCompany = groupByCompany(diligenceReports);
  const remediationByCompany = groupByCompany(remediationTasks);
  const reviewsByCompany = groupByCompany(adminReviews);
  const complianceByCompany = groupByCompany(complianceEvents);
  const interestsByCompany = groupByCompany(interests);
  const introsByCompany = groupByCompany(introRequests);
  const threadsByCompany = groupByCompany(threads);
  const meetingsByCompany = groupByCompany(meetings);
  const learningByCompany = groupByCompany(learningRows);

  const companyDiligence = companies.map((company) => {
    const companyDocs = documentsByCompany.get(company.id) ?? [];
    const reports = diligenceByCompany.get(company.id) ?? [];
    const tasks = remediationByCompany.get(company.id) ?? [];
    const reviews = reviewsByCompany.get(company.id) ?? [];
    const events = complianceByCompany.get(company.id) ?? [];
    const companyInterests = interestsByCompany.get(company.id) ?? [];
    const intros = introsByCompany.get(company.id) ?? [];
    const companyThreads = threadsByCompany.get(company.id) ?? [];
    const companyMeetings = meetingsByCompany.get(company.id) ?? [];
    const learning = learningByCompany.get(company.id) ?? [];

    const latestReport = reports[0];
    const readinessHistory = reports.slice(0, 5).map((r) => ({
      score: r.readiness_score,
      created_at: r.created_at,
    }));

    const openTasks = tasks.filter((t) => t.status !== "completed");
    const completedTasks = tasks.filter((t) => t.status === "completed");
    const highPriorityOpen = openTasks.filter((t) => t.priority === "high");
    const gapCategories = [...new Set(openTasks.map((t) => t.category))];

    const latestReview = reviews[0];
    const openCompliance = events.filter((e) => ["open", "under_review"].includes(e.status));
    const severityBreakdown: Record<string, number> = {};
    for (const event of events) {
      severityBreakdown[event.severity] = (severityBreakdown[event.severity] ?? 0) + 1;
    }
    const flaggedIndicators = events.filter((e) =>
      FLAGGED_COMPLIANCE_EVENT_TYPES.has(e.event_type),
    ).length;

    const pitchDeckPresent = companyDocs.some(
      (d) => String(d.document_type ?? "").toUpperCase() === "PITCH_DECK",
    );
    const approvedDocs = companyDocs.filter((d) => d.is_approved).length;
    const missingRequired = Array.isArray(latestReport?.missing_documents)
      ? (latestReport.missing_documents as unknown[]).map(String)
      : [];

    const pledgeTotal = companyInterests.reduce(
      (sum, row) => sum + (Number(row.pledge_amount) || 0),
      0,
    );
    const learningCompleted = learning.filter((row) => row.status === "completed").length;

    const readinessScore = latestReport?.readiness_score ?? null;
    const riskScore =
      (readinessScore != null && readinessScore < 50 ? 3 : readinessScore != null && readinessScore < 70 ? 2 : 1) +
      openCompliance.filter((e) => e.severity === "critical" || e.severity === "high").length +
      highPriorityOpen.length;

    return {
      company_id: company.id,
      company_name: company.company_name,
      founder_id: company.founder_id,
      industry: company.industry,
      funding_stage: company.revenue_stage,
      target_raise: company.funding_amount,
      headquarters: [company.state, company.country].filter(Boolean).join(", ") || null,
      marketplace_published: company.is_published,
      marketplace_visible: company.marketplace_visible,
      review_status: company.review_status,
      latest_readiness_score: readinessScore,
      readiness_score_history: readinessHistory,
      onboarding_progress_percent: company.onboarding_progress_percent ?? 0,
      onboarding_completed_at: company.onboarding_completed_at,
      current_milestone: resolveOnboardingMilestone(
        company.onboarding_step_state as Record<string, unknown> | null,
      ),
      document_count: companyDocs.length,
      pitch_deck_present: pitchDeckPresent,
      documents_approved_count: approvedDocs,
      missing_required_documents: missingRequired,
      remediation_open: openTasks.length,
      remediation_completed: completedTasks.length,
      remediation_high_priority_open: highPriorityOpen.length,
      remediation_gap_categories: gapCategories,
      latest_admin_review_status: latestReview?.status ?? null,
      latest_admin_review_feedback: latestReview?.feedback ?? latestReview?.notes ?? null,
      open_compliance_events: openCompliance.length,
      compliance_severity_breakdown: severityBreakdown,
      flagged_outreach_social_message_indicators: flaggedIndicators,
      expressed_interest_count: companyInterests.length,
      indicative_pledge_total: pledgeTotal,
      intro_request_count: intros.length,
      message_thread_count: companyThreads.length,
      meetings_scheduled_count: companyMeetings.filter((m) => m.status === "scheduled").length,
      learning_modules_completed: learningCompleted,
      learning_progress_rows: learning.length,
      risk_score: riskScore,
      updated_at: company.updated_at,
    };
  });

  const limitedDiligence = limitRows(companyDiligence, preview);
  const sortedByRisk = [...companyDiligence].sort((a, b) => b.risk_score - a.risk_score);
  const topRisk = limitRows(sortedByRisk, preview).slice(0, 10);

  const readinessBuckets: Record<string, number> = {
    "0-49": 0,
    "50-69": 0,
    "70-89": 0,
    "90+": 0,
    unknown: 0,
  };
  for (const row of companyDiligence) {
    const score = row.latest_readiness_score;
    if (score == null) {
      readinessBuckets.unknown += 1;
    } else if (score < 50) {
      readinessBuckets["0-49"] += 1;
    } else if (score < 70) {
      readinessBuckets["50-69"] += 1;
    } else if (score < 90) {
      readinessBuckets["70-89"] += 1;
    } else {
      readinessBuckets["90+"] += 1;
    }
  }

  const readinessDistribution = Object.entries(readinessBuckets).map(([bucket, count]) => ({
    bucket,
    count,
  }));

  const scores = companyDiligence
    .map((c) => c.latest_readiness_score)
    .filter((s): s is number => s != null);
  const avgReadiness =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return {
    meta: {
      reportType: "due_diligence",
      generatedAt,
      preview,
      filters,
      privacyNotice: PRIVACY_NOTICE,
    },
    summary: {
      companiesIncluded: companyDiligence.length,
      averageReadinessScore: avgReadiness,
      companiesWithOpenCompliance: companyDiligence.filter((c) => c.open_compliance_events > 0).length,
      totalExpressedInterests: companyDiligence.reduce((s, c) => s + c.expressed_interest_count, 0),
      totalIndicativePledge: companyDiligence.reduce((s, c) => s + c.indicative_pledge_total, 0),
      companiesMissingPitchDeck: companyDiligence.filter((c) => !c.pitch_deck_present).length,
    },
    sections: {
      company_diligence: limitedDiligence.map((row) => ({
        ...row,
        readiness_score_history: JSON.stringify(row.readiness_score_history),
        remediation_gap_categories: row.remediation_gap_categories.join("; "),
        missing_required_documents: row.missing_required_documents.join("; "),
        compliance_severity_breakdown: JSON.stringify(row.compliance_severity_breakdown),
      })),
      top_risk_companies: topRisk.map((row) => ({
        company_id: row.company_id,
        company_name: row.company_name,
        risk_score: row.risk_score,
        latest_readiness_score: row.latest_readiness_score,
        open_compliance_events: row.open_compliance_events,
        remediation_high_priority_open: row.remediation_high_priority_open,
      })),
      readiness_distribution: readinessDistribution,
    },
  };
}

function groupByCompany<T extends { company_id: string | null }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.company_id) {
      continue;
    }
    const list = map.get(row.company_id) ?? [];
    list.push(row);
    map.set(row.company_id, list);
  }
  return map;
}

/** Flatten primary section rows for CSV export. */
export function flattenReportForCsv(payload: AdminReportPayload): Record<string, unknown>[] {
  if (payload.meta.reportType === "due_diligence") {
    return payload.sections.company_diligence ?? [];
  }

  const sectionKeys = Object.keys(payload.sections);
  if (sectionKeys.length === 0) {
    return [{ reportType: payload.meta.reportType, ...payload.summary }];
  }

  const primary = sectionKeys[0];
  const rows = payload.sections[primary] ?? [];
  if (rows.length > 0) {
    return rows;
  }

  for (const key of sectionKeys.slice(1)) {
    const alt = payload.sections[key] ?? [];
    if (alt.length > 0) {
      return alt;
    }
  }

  return [{ reportType: payload.meta.reportType, ...payload.summary }];
}

export async function loadAdminReportFilterOptions(admin: SupabaseClient<Database>) {
  const [companies, founders, investors] = await Promise.all([
    admin
      .from("companies")
      .select("id, company_name")
      .order("company_name", { ascending: true })
      .limit(200),
    admin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("role", "founder")
      .order("full_name", { ascending: true })
      .limit(200),
    admin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("role", "investor")
      .order("full_name", { ascending: true })
      .limit(200),
  ]);

  return {
    companies: companies.data ?? [],
    founders: founders.data ?? [],
    investors: investors.data ?? [],
  };
}
