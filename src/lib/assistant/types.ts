export const ASSISTANT_MODES = [
  "founder_workflow",
  "investor_workflow",
  "admin_operations",
  "learning",
  "spv_guidance",
  "compliance_guidance",
  "reports_guidance",
  // Page-specific modes
  "crm",
  "tasks",
  "billing",
  "deal_room",
  "capital_raise",
  "cmo_marketing",
  "investor_pipeline",
  "investor_portfolio",
  "investor_matching",
] as const;

export type AssistantMode = (typeof ASSISTANT_MODES)[number];

export type AssistantActionType =
  | "navigation"
  | "workflow"
  | "learning"
  | "compliance"
  | "report"
  | "integration";

export type AssistantSuggestedAction = {
  label: string;
  href: string;
  type: AssistantActionType;
  priority: "high" | "medium" | "low";
};

export type AssistantRelatedLink = {
  label: string;
  href: string;
};

export type SanitizedAssistantContext = {
  role: "founder" | "investor" | "admin" | "analyst";
  mode: AssistantMode;
  workspaceLabel: string;
  currentPath: string | null;
  entity: {
    type: string;
    id: string;
    label: string | null;
  } | null;
  summary: Record<string, string | number | boolean | null>;
  highlights: string[];
};

export type AssistantChatRequest = {
  message?: string;
  intent?: "chat" | "opened";
  mode?: AssistantMode;
  currentPath?: string;
  entityType?: string;
  entityId?: string;
  courseSlug?: string;
  lessonSlug?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type AssistantChatResponse = {
  answer: string;
  suggestedActions: AssistantSuggestedAction[];
  relatedLinks: AssistantRelatedLink[];
  safetyNotes: string[];
  contextUsed: string[];
  mode: AssistantMode;
  provider: "claude" | "fallback" | "guardrail" | "learning";
};
