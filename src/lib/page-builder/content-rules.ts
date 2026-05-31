/** Block copy phrases blocked in Page Builder Lab previews. */
export const PAGE_BUILDER_FORBIDDEN_PHRASES = [
  "guaranteed funding",
  "guaranteed investment",
  "risk-free investment",
  "assured returns",
] as const;

export const PROCESS_STEP_ICON_OPTIONS = [
  "check",
  "shield",
  "rocket",
  "users",
  "file-text",
  "chart",
  "lock",
  "sparkles",
] as const;

export type ProcessStepIcon = (typeof PROCESS_STEP_ICON_OPTIONS)[number];

export const COMPLIANCE_NOTICE_STYLES = ["info", "warning", "legal"] as const;

export type ComplianceNoticeStyle = (typeof COMPLIANCE_NOTICE_STYLES)[number];

export function isProcessStepIcon(value: string): value is ProcessStepIcon {
  return (PROCESS_STEP_ICON_OPTIONS as readonly string[]).includes(value);
}

export function isComplianceNoticeStyle(value: string): value is ComplianceNoticeStyle {
  return (COMPLIANCE_NOTICE_STYLES as readonly string[]).includes(value);
}
