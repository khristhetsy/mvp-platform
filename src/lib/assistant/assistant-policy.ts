import { COACH_DISCLAIMER, isQuizAnswerRequest, isRestrictedAdviceRequest } from "@/lib/learning/class-assistant-guardrails";

export const ASSISTANT_DISCLAIMER =
  "CapitalOS Assistant provides operational workflow guidance only. This is not legal, tax, investment, or securities advice. Approval, funding, and investor outcomes are never guaranteed.";

export const ASSISTANT_SAFETY_NOTES = [
  "Guidance is based on your permitted workspace summaries — not raw documents or private messages.",
  "Contact qualified counsel or CapitalOS admin/compliance teams for legal or regulatory decisions.",
  "Investor interest indicators are non-binding and do not represent committed capital.",
] as const;

export function getAssistantGuardrailReply(message: string): string | null {
  if (isQuizAnswerRequest(message)) {
    return "I can't provide quiz answers. Use Founder Learning courses for educational content, or ask me to explain a readiness workflow step.";
  }
  if (isRestrictedAdviceRequest(message)) {
    return "I can't provide legal, tax, investment, or securities advice. I can explain CapitalOS workflow steps, required documents, and where to go next in your workspace.";
  }
  return null;
}

export function assistantDisclaimers(): string[] {
  return [ASSISTANT_DISCLAIMER, COACH_DISCLAIMER];
}

export function sanitizeAssistantHistory(
  history: Array<{ role: "user" | "assistant"; content: string }> | undefined,
) {
  if (!history?.length) return [];
  return history
    .filter((entry) => entry.role === "user" || entry.role === "assistant")
    .slice(-6)
    .map((entry) => ({
      role: entry.role,
      content: entry.content.slice(0, 2000),
    }));
}
