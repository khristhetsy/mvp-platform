import type { AssistantMode, AssistantRelatedLink, AssistantSuggestedAction, SanitizedAssistantContext } from "@/lib/assistant/types";

function pushAction(
  actions: AssistantSuggestedAction[],
  action: AssistantSuggestedAction,
) {
  if (actions.some((item) => item.href === action.href)) return;
  actions.push(action);
}

export function buildSuggestedActions(ctx: SanitizedAssistantContext): AssistantSuggestedAction[] {
  const actions: AssistantSuggestedAction[] = [];
  const s = ctx.summary;

  if (ctx.role === "founder") {
    if (!s.companyLinked) {
      pushAction(actions, {
        label: "Complete onboarding",
        href: "/founder/onboarding",
        type: "workflow",
        priority: "high",
      });
    }
    if (Number(s.documentsMissingCount ?? 0) > 0 || !s.pitchDeckUploaded) {
      pushAction(actions, {
        label: "Upload pitch deck",
        href: "/founder/documents",
        type: "workflow",
        priority: "high",
      });
    }
    if (Number(s.remediationActiveCount ?? 0) > 0) {
      pushAction(actions, {
        label: "Review remediation tasks",
        href: "/founder/readiness",
        type: "workflow",
        priority: "high",
      });
    }
    pushAction(actions, {
      label: "View readiness",
      href: "/founder/readiness",
      type: "report",
      priority: "medium",
    });
    pushAction(actions, {
      label: "Open learning",
      href: "/founder/learning",
      type: "learning",
      priority: "medium",
    });
    pushAction(actions, {
      label: "Company settings",
      href: "/founder/settings",
      type: "workflow",
      priority: "low",
    });
    pushAction(actions, {
      label: "Connect Google Calendar",
      href: "/founder/settings",
      type: "integration",
      priority: "low",
    });
  }

  if (ctx.role === "investor") {
    if (s.approvalStatus !== "approved") {
      pushAction(actions, {
        label: "Complete investor onboarding",
        href: "/investor/onboarding",
        type: "workflow",
        priority: "high",
      });
    }
    pushAction(actions, {
      label: "Open investor opportunities",
      href: "/investor/opportunities",
      type: "workflow",
      priority: "high",
    });
    pushAction(actions, {
      label: "View watchlist",
      href: "/investor/watchlist",
      type: "workflow",
      priority: "medium",
    });
    if (Number(s.pendingSpvRequirementsCount ?? 0) > 0) {
      pushAction(actions, {
        label: "View SPV requirements",
        href: "/investor/spvs",
        type: "workflow",
        priority: "high",
      });
    } else {
      pushAction(actions, {
        label: "View SPV participations",
        href: "/investor/spvs",
        type: "workflow",
        priority: "medium",
      });
    }
    pushAction(actions, {
      label: "Request intro",
      href: "/investor/opportunities",
      type: "workflow",
      priority: "medium",
    });
  }

  if (ctx.role === "admin" || ctx.role === "analyst") {
    if (Number(s.pendingCompanyReviews ?? 0) > 0) {
      pushAction(actions, {
        label: "Review companies",
        href: "/admin/companies",
        type: "workflow",
        priority: "high",
      });
    }
    if (Number(s.pendingInvestorApprovals ?? 0) > 0) {
      pushAction(actions, {
        label: "Review investor approvals",
        href: "/admin/investors",
        type: "workflow",
        priority: "high",
      });
    }
    if (Number(s.complianceEscalations ?? 0) > 0) {
      pushAction(actions, {
        label: "Open compliance queue",
        href: "/admin/compliance",
        type: "compliance",
        priority: "high",
      });
    }
    if (Number(s.spvBlockers ?? 0) > 0) {
      pushAction(actions, {
        label: "Review SPV blockers",
        href: "/admin/queues?queue=spv_blockers",
        type: "workflow",
        priority: "high",
      });
    }
    pushAction(actions, {
      label: "Open operational queues",
      href: "/admin/queues",
      type: "workflow",
      priority: "medium",
    });
    pushAction(actions, {
      label: "Generate report",
      href: "/admin/reports",
      type: "report",
      priority: "medium",
    });
    pushAction(actions, {
      label: "Open imports",
      href: "/admin/imports",
      type: "workflow",
      priority: "low",
    });
  }

  if (ctx.mode === "spv_guidance" && ctx.entity?.type === "spv") {
    pushAction(actions, {
      label: "Open SPV workspace",
      href: `/admin/spvs/${ctx.entity.id}`,
      type: "workflow",
      priority: "high",
    });
  }

  return actions.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.priority] - rank[b.priority];
  });
}

export function buildRelatedLinks(ctx: SanitizedAssistantContext): AssistantRelatedLink[] {
  const links: AssistantRelatedLink[] = [];

  if (ctx.currentPath && ctx.currentPath.startsWith("/")) {
    links.push({ label: "Current page", href: ctx.currentPath });
  }

  if (ctx.entity?.type === "company" && ctx.entity.id) {
    links.push({ label: "Company workspace", href: `/admin/companies/${ctx.entity.id}` });
  }
  if (ctx.entity?.type === "investor" && ctx.entity.id) {
    links.push({ label: "Investor workspace", href: `/admin/investors/${ctx.entity.id}` });
  }
  if (ctx.entity?.type === "spv" && ctx.entity.id) {
    links.push({
      label: "SPV workspace",
      href: ctx.role === "investor" ? "/investor/spvs" : `/admin/spvs/${ctx.entity.id}`,
    });
  }

  return links.slice(0, 4);
}

export function suggestedPromptChips(ctx: SanitizedAssistantContext): string[] {
  if (ctx.mode === "spv_guidance") {
    return ["What is blocking this SPV?", "What requirements are pending?", "What are the next SPV steps?"];
  }
  if (ctx.mode === "compliance_guidance") {
    return ["What needs compliance review?", "What escalations are open?", "What should admin review next?"];
  }
  if (ctx.mode === "reports_guidance") {
    return ["How do I improve readiness?", "What is missing from my report?", "What documents are still pending?"];
  }
  if (ctx.mode === "learning") {
    return ["What course should I take next?", "Explain investor readiness basics", "How does learning tie to readiness?"];
  }
  if (ctx.role === "admin" || ctx.role === "analyst") {
    return ["What needs attention?", "What is in the review queue?", "Summarize SPV blockers"];
  }
  if (ctx.role === "investor") {
    return ["What should I do next?", "Why can't I access SPVs?", "How do I request an intro?"];
  }
  return ["What should I do next?", "Why is this locked?", "What documents are pending?"];
}
