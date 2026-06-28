import { z } from "zod";

export const companyOnboardingSchema = z.object({
  company_name: z.string().min(2),
  industry: z.string().min(2),
  country: z.string().min(2),
  state: z.string().optional(),
  description: z.string().min(50),
  fundingAmount: z.coerce.number().positive(),
  useOfFunds: z.string().min(20),
  revenueStage: z.string().min(2),
  teamInfo: z.string().min(20),
  capTableSummary: z.string().min(20),
});

export const companyCreateSchema = z.object({
  company_name: z.string().min(2),
  industry: z.string().min(2).optional(),
  country: z.string().min(2).optional(),
  state: z.string().optional(),
  business_description: z.string().min(20).optional(),
  website: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  funding_amount: z.coerce.number().positive().optional(),
  use_of_funds: z.string().min(10).optional(),
  revenue_stage: z.string().min(2).optional(),
  team_summary: z.string().min(10).optional(),
  cap_table_summary: z.string().min(10).optional(),
});

export const companyUpdateSchema = z.object({
  company_name: z.string().min(2).optional(),
  business_description: z.string().min(20).optional(),
  website: z.string().url().optional().or(z.literal("")),
  industry: z.string().min(2).optional(),
  logo_url: z.string().url().optional().or(z.literal("")),
  country: z.string().min(2).optional(),
  state: z.string().optional(),
  incorporation_jurisdiction: z.string().max(120).optional(),
  funding_amount: z.coerce.number().positive().optional(),
  use_of_funds: z.string().min(10).optional(),
  revenue_stage: z.string().min(2).optional(),
  founder_goals: z.string().min(10).optional(),
  team_summary: z.string().max(1000).optional(),
});

export const founderOnboardingStepSchema = z.object({
  step: z.enum([
    "company_profile",
    "funding_information",
    "documents_uploaded",
    "readiness_generated",
    "investor_readiness_review",
  ]),
  advanceToStep: z
    .enum([
      "company_profile",
      "funding_information",
      "documents_uploaded",
      "readiness_generated",
      "investor_readiness_review",
    ])
    .optional(),
  // All string fields accept empty strings — empty means "skip this field"
  company_name: z.string().optional(),
  contact_phone: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  incorporation_jurisdiction: z.string().optional(),
  business_description: z.string().optional(),
  founder_goals: z.string().optional(),
  funding_amount: z.coerce.number().positive().optional(),
  revenue_stage: z.string().optional(),
  use_of_funds: z.string().optional(),
});

export const documentUploadSchema = z.object({
  companyId: z.string().min(1),
  documentType: z.enum([
    "PITCH_DECK",
    "CAP_TABLE",
    "BUSINESS_PLAN",
    "FINANCIAL_STATEMENTS",
    "FINANCIALS",
    "TEAM_BIOS",
    "LEGAL_DOCUMENTS",
    "LEGAL_DOCUMENT",
    "OTHER",
    // Legacy/extended types (kept for backward compatibility)
    "CORPORATE_DOCUMENTS",
    "CUSTOMER_CONTRACTS",
    "MARKET_RESEARCH",
  ]),
});

export const investorDealTargetSchema = z
  .object({
    companyId: z.string().uuid().optional(),
    companySlug: z.string().min(1).optional(),
    message: z.string().max(1000).optional(),
  })
  .refine((value) => Boolean(value.companyId || value.companySlug), {
    message: "companyId or companySlug is required.",
  });

export const investorPledgeSchema = z
  .object({
    companyId: z.string().uuid().optional(),
    companySlug: z.string().min(1).optional(),
    pledgeAmount: z.coerce.number().positive("Pledge amount must be greater than zero."),
    pledgeCurrency: z.string().length(3).optional().default("USD"),
  })
  .refine((value) => Boolean(value.companyId || value.companySlug), {
    message: "companyId or companySlug is required.",
  });

export const investorInterestSchema = investorDealTargetSchema;

export const investorIntroRequestSchema = investorDealTargetSchema;

export const investorSaveDealSchema = z
  .object({
    companyId: z.string().uuid().optional(),
    companySlug: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.companyId || value.companySlug), {
    message: "companyId or companySlug is required.",
  });

export const signedDocumentUrlSchema = z.object({
  documentId: z.string().uuid(),
});

export const diligenceReportCreateSchema = z.object({
  companyId: z.string().uuid(),
  executiveSummary: z.string().min(10).optional(),
});

export const adminReviewActionSchema = z.object({
  action: z.enum(["approve", "reject", "changes_requested"]),
  feedback: z.string().max(5000).optional(),
});

export const investorOnboardingSchema = z
  .object({
    investor_type: z.enum(["individual", "angel_group", "family_office", "venture_fund", "corporate", "other"]),
    firm_name: z.string().max(200).optional(),
    check_size_min: z.coerce.number().nonnegative().optional(),
    check_size_max: z.coerce.number().positive().optional(),
    preferred_sectors: z.string().min(2),
    preferred_geographies: z.string().min(2),
    preferred_stages: z.string().min(2),
    accredited_status: z.boolean(),
    investment_thesis: z.string().min(20).max(5000),
    contact_preference: z.enum(["platform", "email", "phone"]),
    address_line1: z.string().max(300).optional(),
    address_city: z.string().max(120).optional(),
    address_state: z.string().max(120).optional(),
    address_postal_code: z.string().max(40).optional(),
    address_country: z.string().max(120).optional(),
    submit: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.submit && !data.accredited_status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Accredited investor self-attestation is required to submit.",
        path: ["accredited_status"],
      });
    }
  });

export const adminInvestorReviewActionSchema = adminReviewActionSchema;

export const adminInvestorPipelineUpdateSchema = z.object({
  stage: z.enum(["interested", "meeting_requested", "follow_up"]).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(5000).nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  clearFollowUp: z.boolean().optional(),
  markContacted: z.boolean().optional(),
  lastContactedAt: z.string().datetime().optional(),
  ownerAdminId: z.string().uuid().optional(),
  clearOwner: z.boolean().optional(),
});

export const threadMessageSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const threadMeetingCreateSchema = z.object({
  proposedStartTime: z.string().datetime().optional(),
  proposedEndTime: z.string().datetime().optional(),
  timezone: z.string().max(64).optional(),
  meetingTitle: z.string().max(200).optional(),
  meetingNotes: z.string().max(5000).optional(),
});

export const threadMeetingUpdateSchema = z.object({
  action: z.enum(["accept", "decline", "cancel", "propose"]),
  proposedStartTime: z.string().datetime().optional(),
  proposedEndTime: z.string().datetime().optional(),
  timezone: z.string().max(64).optional(),
  meetingNotes: z.string().max(5000).optional(),
});

const optionalUrlField = z.string().url().optional().or(z.literal(""));

export const founderInvestorContactSchema = z.object({
  investor_name: z.string().min(1).max(200),
  firm_name: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  website: optionalUrlField,
  linkedin_url: optionalUrlField,
  twitter_url: optionalUrlField,
  crunchbase_url: optionalUrlField,
  personal_website_url: optionalUrlField,
  other_social_url: optionalUrlField,
  investor_type: z.string().max(100).optional(),
  preferred_sectors: z.string().max(500).optional(),
  preferred_stages: z.string().max(500).optional(),
  check_size_min: z.coerce.number().nonnegative().optional(),
  check_size_max: z.coerce.number().nonnegative().optional(),
  geography: z.string().max(200).optional(),
  source: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional(),
  status: z
    .enum([
      "new",
      "researching",
      "selected",
      "contacted",
      "responded",
      "meeting_scheduled",
      "not_interested",
      "archived",
    ])
    .optional(),
});

export const founderInvestorContactImportSchema = z.object({
  confirm: z.boolean().optional(),
  rows: z.array(
    z.object({
      investor_name: z.string().optional(),
      firm_name: z.string().optional(),
      email: z.string().optional(),
      investor_type: z.string().optional(),
      sector: z.string().optional(),
      stage: z.string().optional(),
      check_size: z.string().optional(),
      geography: z.string().optional(),
      website: z.string().optional(),
      linkedin_url: z.string().optional(),
      twitter_url: z.string().optional(),
      crunchbase_url: z.string().optional(),
      personal_website_url: z.string().optional(),
      other_social_url: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
});

export const socialOutreachDraftGenerateSchema = z.object({
  draftType: z.enum([
    "linkedin_campaign_announcement",
    "investor_update",
    "readiness_milestone",
    "traction_update",
    "fundraising_update",
    "thought_leadership",
    "follow_up_post",
  ]),
  platform: z.enum(["linkedin", "x_twitter", "general"]).default("linkedin"),
  campaignId: z.string().uuid().optional(),
  save: z.boolean().optional(),
});

export const socialOutreachDraftCreateSchema = z.object({
  draftType: z.enum([
    "linkedin_campaign_announcement",
    "investor_update",
    "readiness_milestone",
    "traction_update",
    "fundraising_update",
    "thought_leadership",
    "follow_up_post",
  ]),
  platform: z.enum(["linkedin", "x_twitter", "general"]),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(15000),
  campaignId: z.string().uuid().optional(),
});

export const socialOutreachDraftUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(15000).optional(),
  action: z.enum(["review", "copy", "archive", "approve_compliance"]).optional(),
});

export const outreachDraftSchema = z.object({
  kind: z.enum(["intro", "follow_up", "meeting_request", "investor_update"]),
  contactId: z.string().uuid(),
});

export const outreachCampaignSchema = z.object({
  name: z.string().min(2).max(120),
  dailyLimit: z.coerce.number().int().min(1).max(25).optional(),
  contactIds: z.array(z.string().uuid()).max(25).optional(),
  targetIds: z.array(z.string().uuid()).max(25).optional(),
  draftKind: z.enum(["intro", "follow_up", "meeting_request", "investor_update"]).optional(),
});

export const founderOutreachTargetSchema = z
  .object({
    action: z.enum(["select", "move_to_pipeline"]),
    contactId: z.string().uuid().optional(),
    platformInvestorId: z.string().uuid().optional(),
    matchScore: z.coerce.number().int().min(0).max(100).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((value) => Boolean(value.contactId) !== Boolean(value.platformInvestorId), {
    message: "Provide either contactId or platformInvestorId.",
  });

export const founderOutreachTargetUpdateSchema = z.object({
  status: z
    .enum([
      "recommended",
      "selected",
      "intro_requested",
      "contacted",
      "responded",
      "meeting_scheduled",
      "declined",
      "archived",
    ])
    .optional(),
  notes: z.string().max(2000).optional(),
  action: z.enum(["archive"]).optional(),
});

export const founderPipelineIntroSchema = z.object({
  message: z.string().max(2000).optional(),
});

export const complianceEventUpdateSchema = z.object({
  action: z.enum(["review", "dismiss", "resolve", "escalate"]),
  internalNotes: z.string().max(5000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export const adminReportGenerateSchema = z.object({
  reportType: z.enum([
    "compliance",
    "founder_readiness",
    "investor_activity",
    "outreach_activity",
    "messaging_meetings",
    "subscription_upgrade",
    "due_diligence",
    "spv_readiness",
  ]),
  format: z.enum(["json", "csv", "pdf"]).default("json"),
  preview: z.boolean().optional(),
  filters: z
    .object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      companyId: z.string().uuid().optional(),
      founderId: z.string().uuid().optional(),
      investorId: z.string().uuid().optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      reviewStatus: z
        .enum(["pending", "approved", "rejected", "changes_requested"])
        .optional(),
      spvStatus: z.enum(["draft", "under_review", "open", "closed", "canceled"]).optional(),
      operationalReadinessStatus: z
        .enum([
          "draft",
          "checklist_incomplete",
          "document_ready",
          "investors_pending",
          "ready_for_legal_docs",
          "closed",
        ])
        .optional(),
      closingReviewStatus: z
        .enum([
          "not_started",
          "in_review",
          "approved_for_closing",
          "changes_required",
          "closed_operationally",
          "canceled",
        ])
        .optional(),
    })
    .optional(),
});

export const adminSpvOpportunityCreateSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(3).max(200),
  targetAmount: z.coerce.number().positive().optional(),
  minimumCommitment: z.coerce.number().positive().optional(),
  description: z.string().max(5000).optional(),
  termsSummary: z.string().max(5000).optional(),
  status: z.enum(["draft", "under_review", "open", "closed", "canceled"]).optional(),
});

export const adminSpvOpportunityUpdateSchema = z.object({
  status: z.enum(["draft", "under_review", "open", "closed", "canceled"]).optional(),
  name: z.string().min(3).max(200).optional(),
  targetAmount: z.coerce.number().positive().optional(),
  minimumCommitment: z.coerce.number().positive().optional(),
  description: z.string().max(5000).optional(),
  termsSummary: z.string().max(5000).optional(),
});

export const adminSpvChecklistItemUpdateSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "waived"]),
});

export const adminSpvParticipationRequirementUpdateSchema = z.object({
  status: z.enum(["pending", "uploaded", "under_review", "approved", "rejected", "waived"]),
  reviewNotes: z.string().max(2000).optional(),
});

export const adminSpvDocumentPackageUpdateSchema = z.object({
  status: z.enum([
    "not_started",
    "preparing",
    "under_review",
    "approved",
    "issued",
    "archived",
  ]),
  notes: z.string().max(5000).optional(),
});

export const adminSpvClosingReviewUpdateSchema = z.object({
  status: z.enum([
    "not_started",
    "in_review",
    "approved_for_closing",
    "changes_required",
    "closed_operationally",
    "canceled",
  ]),
  internalNotes: z.string().max(5000).optional(),
  closingTargetOverride: z.boolean().optional(),
});

export const adminSpvParticipationUpdateSchema = z.object({
  status: z.enum([
    "invited",
    "interested",
    "soft_committed",
    "documents_pending",
    "completed",
    "declined",
    "canceled",
  ]),
});

export const investorSpvParticipationSchema = z.object({
  spvOpportunityId: z.string().uuid(),
  indicativeAmount: z.coerce.number().nonnegative().optional(),
  status: z
    .enum([
      "invited",
      "interested",
      "soft_committed",
      "documents_pending",
      "completed",
      "declined",
      "canceled",
    ])
    .optional(),
  notes: z.string().max(2000).optional(),
});

export const companyUpdateCreateSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(8000),
  updateType: z.enum([
    "milestone",
    "fundraising",
    "product",
    "financial",
    "operational",
    "investor_update",
  ]),
  visibility: z.enum(["draft", "interested_investors", "marketplace", "private"]),
  publish: z.boolean().optional(),
});

export const outreachCampaignQueueSchema = z.object({
  action: z.literal("queue"),
});

export const adminImportPreviewSchema = z.object({
  importType: z.enum([
    "companies",
    "investors",
    "founder_contacts",
    "social_links",
    "crm_notes_tags",
    "outreach_contacts",
  ]),
  mapping: z.record(z.string(), z.string()).optional(),
});

export const adminImportConfirmSchema = z.object({
  batchId: z.string().uuid(),
  duplicateBehavior: z.enum(["skip", "update"]).default("skip"),
});

export const adminExportQuerySchema = z.object({
  type: z.enum([
    "companies",
    "investors",
    "founder_contacts",
    "spv_readiness",
    "compliance_events",
    "outreach_campaigns",
    "due_diligence",
    "investor_activity",
  ]),
  format: z.enum(["csv", "xlsx", "json"]).default("csv"),
});

export const assistantChatSchema = z.object({
  message: z.string().trim().max(2000).optional(),
  intent: z.enum(["chat", "opened"]).optional().default("chat"),
  mode: z
    .enum([
      "founder_workflow",
      "investor_workflow",
      "admin_operations",
      "learning",
      "spv_guidance",
      "compliance_guidance",
      "reports_guidance",
      "crm",
      "tasks",
      "billing",
      "deal_room",
      "capital_raise",
      "cmo_marketing",
      "investor_pipeline",
      "investor_portfolio",
      "investor_matching",
    ])
    .optional(),
  currentPath: z.string().max(500).optional(),
  entityType: z.string().max(64).optional(),
  entityId: z.string().max(64).optional(),
  courseSlug: z.string().max(120).optional(),
  lessonSlug: z.string().max(120).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

export const nextBestActionLifecycleSchema = z.object({
  action: z.enum(["complete", "dismiss", "snooze", "reopen", "escalate"]),
  snoozedUntil: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});
