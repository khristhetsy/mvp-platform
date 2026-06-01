import OpenAI from "openai";
import {
  buildCatalogCoachContext,
  buildPersonalCoachContext,
  COACH_DISCLAIMER,
  resolveCoachLesson,
  runPersonalCoach,
} from "@/lib/learning/class-assistant";
import { computeCoursePercentComplete } from "@/lib/learning/course-progress";
import { FOUNDER_COURSES } from "@/lib/learning/courses";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import {
  ASSISTANT_DISCLAIMER,
  ASSISTANT_SAFETY_NOTES,
  getAssistantGuardrailReply,
  sanitizeAssistantHistory,
} from "@/lib/assistant/assistant-policy";
import { buildRelatedLinks } from "@/lib/assistant/assistant-actions";
import { hrefForActionCenterIntent, resolveActionCenterIntent } from "@/lib/actions/filters";
import { isNextBestActionIntent } from "@/lib/next-best-actions/compute";
import { loadAndMergeNextBestActions } from "@/lib/next-best-actions/lifecycle";
import {
  formatActionsForAssistantAnswer,
  toAssistantSuggestedActions,
} from "@/lib/next-best-actions/display";
import { contextUsedKeys } from "@/lib/assistant/assistant-context";
import { buildAssistantSystemPrompt } from "@/lib/assistant/assistant-prompts";
import { loadAdminAssistantContext } from "@/lib/assistant/load-admin-assistant-context";
import { loadFounderAssistantContext } from "@/lib/assistant/load-founder-assistant-context";
import { loadInvestorAssistantContext } from "@/lib/assistant/load-investor-assistant-context";
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  SanitizedAssistantContext,
} from "@/lib/assistant/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Profile, Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function buildFallbackAnswer(message: string, ctx: SanitizedAssistantContext): string {
  const lower = message.toLowerCase();
  const highlights = ctx.highlights.length ? ctx.highlights.join(" ") : "Your workspace summaries are loaded.";

  if (ctx.role === "founder") {
    if (lower.includes("next") || lower.includes("should i")) {
      if (!ctx.summary.companyLinked) {
        return "Link your company profile first via onboarding. That unlocks document uploads, readiness scoring, and admin review.";
      }
      if (Number(ctx.summary.documentsMissingCount ?? 0) > 0) {
        return `${highlights} Upload missing diligence documents next, then review readiness remediation tasks.`;
      }
      if (Number(ctx.summary.remediationActiveCount ?? 0) > 0) {
        return `${highlights} Focus on open remediation tasks on the Readiness page before requesting marketplace publication.`;
      }
      return `${highlights} Continue onboarding, keep documents current, and monitor investor activity from your dashboard.`;
    }
    if (lower.includes("locked") || lower.includes("why")) {
      return `${highlights} Features may stay locked until onboarding, required documents, or admin review steps are complete.`;
    }
    if (lower.includes("document") || lower.includes("pitch")) {
      return `${highlights} Use Documents to upload your pitch deck and diligence files. Uploaded counts are tracked — file contents are never shared with the assistant.`;
    }
    return `${highlights} Ask about onboarding, documents, readiness, learning, or investor activity indicators.`;
  }

  if (ctx.role === "investor") {
    if (lower.includes("spv") || lower.includes("access")) {
      if (ctx.summary.approvalStatus !== "approved") {
        return "SPV and some marketplace actions typically require an approved investor profile. Complete onboarding and wait for admin approval — approval is not guaranteed.";
      }
      if (Number(ctx.summary.pendingSpvRequirementsCount ?? 0) > 0) {
        return `${highlights} You have pending SPV document requirements. Open SPVs to upload supporting items for your participations.`;
      }
      return `${highlights} Approved investors can browse SPV opportunities and manage participations from the SPV workspace.`;
    }
    if (lower.includes("intro")) {
      return "Request intros from published opportunities. Intro requests are operational signals only — they do not guarantee meetings or investment.";
    }
    return `${highlights} Review opportunities, manage your watchlist, and track intro requests from your investor dashboard.`;
  }

  if (ctx.mode === "spv_guidance" && ctx.entity?.label) {
    return `${ctx.entity.label}. ${highlights} Review SPV readiness, investor requirements, and operational queues for blockers.`;
  }

  if (lower.includes("attention") || lower.includes("review") || lower.includes("next")) {
    return `${highlights} Start with the highest-count operational queues, then drill into company, investor, or SPV workspaces as needed.`;
  }

  return `${highlights} Use operational queues, compliance, and reports modules for structured admin review.`;
}

async function callOpenAIAssistant(
  ctx: SanitizedAssistantContext,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: buildAssistantSystemPrompt(ctx) },
      ...history.map((entry) => ({ role: entry.role, content: entry.content })),
      { role: "user", content: message },
    ],
  });
  return response.output_text?.trim() ?? "";
}

async function runLearningMode(
  profile: Profile,
  supabase: SupabaseClient<Database>,
  input: AssistantChatRequest,
): Promise<AssistantChatResponse> {
  const company = await ensureFounderCompanyForUser(profile);
  const progressRows = company ? await listLessonProgressForCompany(profile.id, company.id) : [];
  const founderName = profile.full_name ?? profile.email ?? "Founder";
  const companyName = company?.company_name ?? null;
  const history = sanitizeAssistantHistory(input.history);

  let coachResult;
  if (input.courseSlug) {
    const resolved = resolveCoachLesson(input.courseSlug, input.lessonSlug ?? null);
    if (!resolved) {
      return {
        answer: "That learning course or lesson was not found. Browse courses at /founder/learning.",
        suggestedActions: [{ label: "Open learning", href: "/founder/learning", type: "learning", priority: "high" }],
        relatedLinks: [{ label: "Founder learning", href: "/founder/learning" }],
        safetyNotes: [...ASSISTANT_SAFETY_NOTES],
        contextUsed: ["learning"],
        mode: "learning",
        provider: "fallback",
      };
    }
    const ctx = buildPersonalCoachContext({
      course: resolved.course,
      lesson: resolved.lesson,
      sectionTitle: resolved.sectionTitle,
      founderName,
      companyName,
      progressRows,
    });
    coachResult = await runPersonalCoach({ message: input.message ?? "", ctx, history });
  } else {
    const overallPercent =
      FOUNDER_COURSES.length > 0
        ? Math.round(
            FOUNDER_COURSES.reduce(
              (sum, course) => sum + computeCoursePercentComplete(course, progressRows),
              0,
            ) / FOUNDER_COURSES.length,
          )
        : 0;
    const ctx = buildCatalogCoachContext({ founderName, companyName, overallPercent });
    coachResult = await runPersonalCoach({ message: input.message ?? "", ctx, history });
  }

  return {
    answer: coachResult.reply,
    suggestedActions: [{ label: "Open learning", href: "/founder/learning", type: "learning", priority: "high" }],
    relatedLinks: [{ label: "Founder learning", href: "/founder/learning" }],
    safetyNotes: [COACH_DISCLAIMER, ...ASSISTANT_SAFETY_NOTES],
    contextUsed: ["learningProgress"],
    mode: "learning",
    provider: coachResult.mode === "openai" ? "openai" : coachResult.mode === "guardrail" ? "guardrail" : "learning",
  };
}

export async function loadAssistantContextForProfile(
  profile: Profile,
  supabase: SupabaseClient<Database>,
  input: AssistantChatRequest,
): Promise<SanitizedAssistantContext> {
  const role = profile.role;
  const loaderInput = {
    currentPath: input.currentPath,
    mode: input.mode,
    entityType: input.entityType,
    entityId: input.entityId,
  };

  if (role === "founder") {
    return loadFounderAssistantContext(profile, supabase, loaderInput);
  }
  if (role === "investor") {
    return loadInvestorAssistantContext(profile, supabase, loaderInput);
  }
  if (role === "admin" || role === "analyst") {
    return loadAdminAssistantContext(profile, createServiceRoleClient(), loaderInput);
  }

  return loadFounderAssistantContext(profile, supabase, loaderInput);
}

export async function runAssistantChat(input: {
  profile: Profile;
  supabase: SupabaseClient<Database>;
  request: AssistantChatRequest;
}): Promise<AssistantChatResponse> {
  const message = input.request.message?.trim() ?? "";
  if (!message) {
    return {
      answer: "Ask a workflow question to get guidance.",
      suggestedActions: [],
      relatedLinks: [],
      safetyNotes: [...ASSISTANT_SAFETY_NOTES],
      contextUsed: [],
      mode: input.request.mode ?? "founder_workflow",
      provider: "fallback",
    };
  }

  const guardrail = getAssistantGuardrailReply(message);
  if (guardrail) {
    return {
      answer: guardrail,
      suggestedActions: [],
      relatedLinks: [],
      safetyNotes: [ASSISTANT_DISCLAIMER, ...ASSISTANT_SAFETY_NOTES],
      contextUsed: [],
      mode: input.request.mode ?? "founder_workflow",
      provider: "guardrail",
    };
  }

  const ctx = await loadAssistantContextForProfile(input.profile, input.supabase, input.request);
  const resolvedMode = input.request.mode ?? ctx.mode;

  if (input.profile.role === "founder" && resolvedMode === "learning") {
    return runLearningMode(input.profile, input.supabase, input.request);
  }

  const nba = await loadAndMergeNextBestActions({
    profile: input.profile,
    supabase: input.supabase,
    options: {
      entityType: input.request.entityType ?? ctx.entity?.type,
      entityId: input.request.entityId ?? ctx.entity?.id,
      contextPath: input.request.currentPath,
      limit: 6,
      sync: true,
      includeInactive: false,
    },
  });

  const suggestedActions = toAssistantSuggestedActions(nba.actions);
  const relatedLinks = buildRelatedLinks({ ...ctx, mode: resolvedMode });
  const history = sanitizeAssistantHistory(input.request.history);

  const actionCenterIntent = resolveActionCenterIntent(message);
  if (actionCenterIntent) {
    const actionCenterHref = hrefForActionCenterIntent(ctx.role, actionCenterIntent);
    relatedLinks.unshift({ label: "Open Action Center", href: actionCenterHref });
    suggestedActions.unshift({
      label: "View filtered actions",
      href: actionCenterHref,
      type: "workflow",
      priority: "high",
    });
  }

  let answer = buildFallbackAnswer(message, ctx);
  if (actionCenterIntent) {
    const filtered = nba.actions.filter((action) => {
      if (actionCenterIntent === "overdue") {
        return action.status === "overdue" || (action.dueAt && new Date(action.dueAt) < new Date());
      }
      if (actionCenterIntent === "critical") return action.priority === "critical";
      if (actionCenterIntent === "spv") return action.category === "spv";
      if (actionCenterIntent === "escalated") return action.status === "escalated";
      return true;
    });
    if (filtered.length > 0) {
      answer = `Here are matching actions from your Action Center:\n\n${formatActionsForAssistantAnswer(filtered)}\n\nOpen the Action Center for full filters and lifecycle controls.`;
    } else {
      answer = `No matching actions in your current list. Open the Action Center to review all workflow items.`;
    }
  } else if (isNextBestActionIntent(message) && nba.actions.length > 0) {
    answer = `Here are your top prioritized actions:\n\n${formatActionsForAssistantAnswer(nba.actions)}\n\n${answer}`;
  }
  let provider: AssistantChatResponse["provider"] = "fallback";

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    try {
      const raw = await callOpenAIAssistant({ ...ctx, mode: resolvedMode }, message, history);
      if (raw) {
        answer = raw;
        provider = "openai";
      }
    } catch {
      answer = buildFallbackAnswer(message, ctx);
      provider = "fallback";
    }
  }

  return {
    answer,
    suggestedActions,
    relatedLinks,
    safetyNotes: [ASSISTANT_DISCLAIMER, ...ASSISTANT_SAFETY_NOTES],
    contextUsed: contextUsedKeys(ctx.summary),
    mode: resolvedMode,
    provider,
  };
}
