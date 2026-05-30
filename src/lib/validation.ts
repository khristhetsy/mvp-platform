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
  funding_amount: z.coerce.number().positive().optional(),
  use_of_funds: z.string().min(10).optional(),
  revenue_stage: z.string().min(2).optional(),
  founder_goals: z.string().min(10).optional(),
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
  company_name: z.string().min(2).optional(),
  website: z.string().url().optional().or(z.literal("")),
  industry: z.string().min(2).optional(),
  country: z.string().min(2).optional(),
  state: z.string().optional(),
  business_description: z.string().min(20).optional(),
  founder_goals: z.string().min(10).optional(),
  funding_amount: z.coerce.number().positive().optional(),
  revenue_stage: z.string().min(2).optional(),
  use_of_funds: z.string().min(10).optional(),
});

export const documentUploadSchema = z.object({
  companyId: z.string().min(1),
  documentType: z.enum([
    "PITCH_DECK",
    "FINANCIAL_STATEMENTS",
    "CAP_TABLE",
    "BUSINESS_PLAN",
    "LEGAL_DOCUMENTS",
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
