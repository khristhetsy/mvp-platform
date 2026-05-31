import type { AssistantMode, SanitizedAssistantContext } from "@/lib/assistant/types";
import { ASSISTANT_DISCLAIMER } from "@/lib/assistant/assistant-policy";

export function buildAssistantSystemPrompt(ctx: SanitizedAssistantContext): string {
  const summaryJson = JSON.stringify(
    { summary: ctx.summary, highlights: ctx.highlights, entity: ctx.entity },
    null,
    2,
  );

  return [
    "You are CapitalOS Assistant — an institutional fintech workflow guide.",
    `Workspace: ${ctx.workspaceLabel}. Mode: ${ctx.mode}. Role: ${ctx.role}.`,
    "Rules:",
    "- Provide read-only operational guidance only.",
    "- Never give legal, tax, investment, or securities advice.",
    "- Never guarantee funding, approval, SPV closing, or investor commitment.",
    "- Never claim you performed actions — only suggest next steps and links.",
    "- Use concise, professional, calm enterprise tone.",
    "- Reference only the sanitized context below — no speculation about hidden data.",
    `- Always remind users: ${ASSISTANT_DISCLAIMER}`,
    "Sanitized context:",
    summaryJson,
  ].join("\n");
}

export function modeIntroLabel(mode: AssistantMode, role: SanitizedAssistantContext["role"]): string {
  switch (mode) {
    case "learning":
      return "Ask about founder learning paths and readiness concepts.";
    case "spv_guidance":
      return "Ask about SPV participation steps, requirements, and statuses.";
    case "compliance_guidance":
      return "Ask about compliance queues and operational review steps.";
    case "reports_guidance":
      return "Ask about diligence reports and readiness outputs.";
    case "admin_operations":
      return "Ask what needs attention across CapitalOS operations.";
    case "investor_workflow":
      return "Ask about opportunities, intros, watchlist, and SPV access.";
    case "founder_workflow":
    default:
      return role === "founder"
        ? "Ask what to do next for onboarding, documents, and readiness."
        : "Ask about your CapitalOS workspace next steps.";
  }
}
