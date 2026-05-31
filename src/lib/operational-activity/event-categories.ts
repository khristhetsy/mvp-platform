import type { OperationalEventCategory } from "@/lib/operational-activity/types";

export const OPERATIONAL_CATEGORY_LABELS: Record<OperationalEventCategory, string> = {
  crm: "CRM",
  onboarding: "Onboarding",
  diligence: "Diligence",
  compliance: "Compliance",
  spv: "SPV",
  investor: "Investor",
  founder: "Founder",
  reporting: "Reporting",
  messaging: "Messaging",
  outreach: "Outreach",
  system: "System",
  imports: "Imports",
  analytics: "Analytics",
};

export function isOperationalEventCategory(value: string): value is OperationalEventCategory {
  return value in OPERATIONAL_CATEGORY_LABELS;
}

export function normalizeOperationalCategory(value: string): OperationalEventCategory {
  return isOperationalEventCategory(value) ? value : "system";
}
