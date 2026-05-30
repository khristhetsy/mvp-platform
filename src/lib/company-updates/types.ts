export const COMPANY_UPDATE_TYPES = [
  "milestone",
  "fundraising",
  "product",
  "financial",
  "operational",
  "investor_update",
] as const;

export type CompanyUpdateType = (typeof COMPANY_UPDATE_TYPES)[number];

export const COMPANY_UPDATE_VISIBILITY = [
  "draft",
  "interested_investors",
  "marketplace",
  "private",
] as const;

export type CompanyUpdateVisibility = (typeof COMPANY_UPDATE_VISIBILITY)[number];

export type CompanyUpdateRecord = {
  id: string;
  company_id: string;
  founder_id: string;
  title: string;
  body: string;
  update_type: CompanyUpdateType | string;
  visibility: CompanyUpdateVisibility | string;
  created_at: string;
  published_at: string | null;
  companies?: { company_name?: string | null; slug?: string | null } | null;
};

export type CompanyUpdateAdminSummary = {
  publishedCount: number;
  latestPublishedAt: string | null;
};
