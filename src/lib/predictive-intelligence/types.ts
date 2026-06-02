export const RISK_SIGNAL_TYPES = [
  "readiness_risk",
  "spv_delay_risk",
  "investor_engagement_risk",
  "compliance_risk",
  "workflow_stall_risk",
  "automation_failure_risk",
  "import_failure_risk",
  "action_overdue_risk",
] as const;

export type RiskSignalType = (typeof RISK_SIGNAL_TYPES)[number];

export type RiskConfidence = "low" | "medium" | "high";

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type RiskEntityType = "platform" | "company" | "spv" | "investor" | "compliance_event";

export type RiskSignal = {
  id: string;
  type: RiskSignalType;
  severity: RiskSeverity;
  score: number; // 0-100
  confidence: RiskConfidence;
  reasonCodes: string[];
  title: string;
  explanation: string;
  entityType: RiskEntityType;
  entityId: string | null;
  companyId?: string | null;
  spvId?: string | null;
  investorId?: string | null;
  href: string;
  sourceData: Record<string, unknown>;
  generatedAt: string;
};

export type RiskRecommendation = {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  explanation: string;
  recommendedAction: string;
  href: string;
  entityType: RiskEntityType;
  entityId: string | null;
  sourceSignalId: string;
  sourceSignalType: RiskSignalType;
  sourceData: Record<string, unknown>;
};

export type PlatformInsightsSnapshot = {
  windowDays: 7 | 30 | 90;
  generatedAt: string;
  riskOverview: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    scoreAvg: number;
  };
  signals: RiskSignal[];
  recommendations: RiskRecommendation[];
};

