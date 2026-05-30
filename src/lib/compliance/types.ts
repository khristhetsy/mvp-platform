export type ComplianceSeverity = "low" | "medium" | "high" | "critical";

export type ComplianceEventStatus = "open" | "under_review" | "resolved" | "dismissed";

export type ComplianceEventRecord = {
  id: string;
  company_id: string | null;
  founder_id: string | null;
  investor_id: string | null;
  event_type: string;
  severity: ComplianceSeverity;
  source: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  status: ComplianceEventStatus;
  internal_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ComplianceEventInput = {
  companyId?: string | null;
  founderId?: string | null;
  investorId?: string | null;
  eventType: string;
  severity: ComplianceSeverity;
  source: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  sourceId?: string;
};
