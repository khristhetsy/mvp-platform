import type { AssistantMode, SanitizedAssistantContext } from "@/lib/assistant/types";
import { ASSISTANT_DISCLAIMER } from "@/lib/assistant/assistant-policy";

function modeSystemContext(mode: AssistantMode, role: SanitizedAssistantContext["role"]): string {
  switch (mode) {
    case "crm":
      return "You are the CapitalOS CRM assistant. Help founders manage contacts, build lists, import leads, apply tags, filter by segment, and track email engagement. Be specific and action-oriented.";
    case "tasks":
      return "You are the CapitalOS task assistant. Help users create, prioritize, assign, and track tasks. Advise on urgency, delegation, and workflows.";
    case "billing":
      return "You are the CapitalOS billing assistant. Help founders understand their plan, subscription status, upgrade options, and how to manage their account. Never process payments.";
    case "deal_room":
      return "You are the CapitalOS deal room assistant. Help founders and investors understand what documents are needed, how to organize a data room, and what investors look for during due diligence.";
    case "capital_raise":
      return "You are the CapitalOS fundraising assistant. Help founders plan their capital raise strategy, understand investor expectations, prepare materials, and navigate the fundraising process.";
    case "cmo_marketing":
      return "You are the CapitalOS CMO AI — a senior marketing strategist. Help the admin team build campaigns, write email copy, plan drip sequences, segment audiences, interpret analytics, and execute marketing strategy. Be bold and strategic like a real CMO.";
    case "investor_pipeline":
      return "You are the CapitalOS investor pipeline assistant. Help investors track deal flow, prioritize opportunities, manage their watchlist, and decide what to pursue next.";
    case "investor_portfolio":
      return "You are the CapitalOS portfolio assistant. Help investors review portfolio companies, track performance, identify risks, and understand their holdings.";
    case "investor_matching":
      return "You are the CapitalOS deal matching assistant. Help investors find and evaluate companies that match their investment thesis, understand match scores, and filter opportunities.";
    case "learning":
      return "You are the CapitalOS learning coach. Guide founders through courses, explain concepts, recommend next lessons, and connect learning to their readiness score.";
    case "spv_guidance":
      return "You are the CapitalOS SPV assistant. Guide users through SPV setup, requirements, participation steps, and compliance checkpoints.";
    case "compliance_guidance":
      return "You are the CapitalOS compliance assistant. Help admins review compliance queues, understand escalations, and manage operational review steps.";
    case "reports_guidance":
      return "You are the CapitalOS readiness assistant. Help founders understand their readiness score, identify what's missing, prioritize improvements, and interpret report outputs.";
    case "admin_operations":
      return "You are the CapitalOS operations assistant. Help admins manage the platform, review queues, handle company and investor approvals, and track operational health.";
    case "investor_workflow":
      return "You are the CapitalOS investor assistant. Help investors navigate opportunities, request intros, manage their watchlist, and understand SPV access.";
    case "founder_workflow":
    default:
      return "You are the CapitalOS founder assistant. Help founders with onboarding, documents, readiness, platform navigation, and next best actions.";
  }
}

export function buildAssistantSystemPrompt(ctx: SanitizedAssistantContext): string {
  const summaryJson = JSON.stringify(
    { summary: ctx.summary, highlights: ctx.highlights, entity: ctx.entity },
    null,
    2,
  );

  return [
    modeSystemContext(ctx.mode, ctx.role),
    `Workspace: ${ctx.workspaceLabel}. Mode: ${ctx.mode}. Role: ${ctx.role}.`,
    "Rules:",
    "- Be specific, helpful, and action-oriented for this page context.",
    "- Never give legal, tax, investment, or securities advice.",
    "- Never guarantee funding, approval, SPV closing, or investor commitment.",
    "- Never claim you performed actions — only suggest next steps and links.",
    "- Use concise, professional, calm enterprise tone.",
    "- Reference only the sanitized context below — no speculation about hidden data.",
    "- Keep responses focused on the current page context unless the user asks otherwise.",
    `- Always remind users: ${ASSISTANT_DISCLAIMER}`,
    "Sanitized context:",
    summaryJson,
  ].join("\n");
}

export function modeIntroLabel(mode: AssistantMode, role: SanitizedAssistantContext["role"]): string {
  switch (mode) {
    case "crm":
      return "Ask me anything about contacts, lists, segmentation, and lead management.";
    case "tasks":
      return "Ask about creating, prioritizing, assigning, and tracking tasks.";
    case "billing":
      return "Ask about your plan, subscription status, or how to upgrade.";
    case "deal_room":
      return "Ask about deal room documents, due diligence prep, and data room setup.";
    case "capital_raise":
      return "Ask about fundraising strategy, investor expectations, and capital raise prep.";
    case "cmo_marketing":
      return "I'm your CMO AI. Ask me to draft campaigns, write copy, plan sequences, or analyze performance.";
    case "investor_pipeline":
      return "Ask about your deal pipeline, watchlist, and which opportunities to prioritize.";
    case "investor_portfolio":
      return "Ask about portfolio companies, performance, and key risks to watch.";
    case "investor_matching":
      return "Ask about company matches, investment thesis fit, and how to evaluate opportunities.";
    case "learning":
      return "Ask about founder learning paths and readiness concepts.";
    case "spv_guidance":
      return "Ask about SPV participation steps, requirements, and statuses.";
    case "compliance_guidance":
      return "Ask about compliance queues and operational review steps.";
    case "reports_guidance":
      return "Ask about your readiness score, what's missing, and how to improve it.";
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
