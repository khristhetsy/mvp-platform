export type InvestorApprovalStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "changes_requested";

export type InvestorKycStatus = "not_started" | "pending" | "verified" | "rejected";

export type InvestorProfileRecord = {
  id: string;
  profile_id: string;
  investor_type: string | null;
  firm_name: string | null;
  check_size_min: number | null;
  check_size_max: number | null;
  preferred_sectors: string[];
  preferred_geographies: string[];
  preferred_stages: string[];
  accredited_status: boolean;
  investment_thesis: string | null;
  contact_preference: string | null;
  approval_status: InvestorApprovalStatus;
  admin_feedback: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  kyc_status: InvestorKycStatus;
  kyc_submitted_at: string | null;
  kyc_reviewed_at: string | null;
  kyc_reviewed_by: string | null;
  kyc_feedback: string | null;
  created_at: string;
  updated_at: string;
};

export type InvestorKycDocumentRecord = {
  id: string;
  investor_profile_id: string;
  doc_type: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: "uploaded" | "archived";
  uploaded_at: string;
};

export const INVESTOR_TYPES = [
  { value: "individual", label: "Individual angel" },
  { value: "angel_group", label: "Angel group / syndicate" },
  { value: "family_office", label: "Family office" },
  { value: "venture_fund", label: "Venture fund" },
  { value: "corporate", label: "Corporate / strategic" },
  { value: "other", label: "Other" },
] as const;

export const CONTACT_PREFERENCES = [
  { value: "platform", label: "In-platform messages" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
] as const;
