import { z } from "zod";

export const companyOnboardingSchema = z.object({
  name: z.string().min(2),
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
  funding_amount: z.coerce.number().positive().optional(),
  use_of_funds: z.string().min(10).optional(),
  revenue_stage: z.string().min(2).optional(),
  team_summary: z.string().min(10).optional(),
  cap_table_summary: z.string().min(10).optional(),
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

export const investorInterestSchema = z.object({
  campaignSlug: z.string().min(1, "Campaign slug is required."),
  interestAmount: z.coerce.number().positive().optional(),
  message: z.string().max(1000).optional(),
  requestedCall: z.coerce.boolean().optional(),
});

export const signedDocumentUrlSchema = z.object({
  documentId: z.string().uuid(),
});

export const diligenceReportCreateSchema = z.object({
  companyId: z.string().uuid(),
  executiveSummary: z.string().min(10).optional(),
});
