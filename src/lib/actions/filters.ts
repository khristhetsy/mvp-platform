import type { ActionCenterFilters, ActionCenterTab } from "@/lib/actions/types";
import type {
  NextBestActionCategory,
  NextBestActionLifecycleStatus,
  NextBestActionPriority,
} from "@/lib/next-best-actions/types";

const VALID_PRIORITIES = new Set(["critical", "high", "medium", "low"]);
const VALID_CATEGORIES = new Set([
  "onboarding",
  "readiness",
  "compliance",
  "investor_engagement",
  "spv",
  "documents",
  "reporting",
  "outreach",
  "admin_review",
  "system",
]);
const VALID_STATUSES = new Set([
  "open",
  "snoozed",
  "dismissed",
  "completed",
  "overdue",
  "escalated",
  "blocked",
]);
const VALID_TABS = new Set(["active", "overdue", "escalated", "completed", "snoozed"]);

function readParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value?.trim() ? value.trim() : null;
}

export function tabToStatuses(tab: ActionCenterTab): NextBestActionLifecycleStatus[] | undefined {
  switch (tab) {
    case "active":
      return ["open", "blocked", "escalated"];
    case "overdue":
      return ["overdue"];
    case "escalated":
      return ["escalated"];
    case "completed":
      return ["completed"];
    case "snoozed":
      return ["snoozed"];
    default:
      return undefined;
  }
}

export function parseActionCenterFilters(
  searchParams: URLSearchParams,
  defaults?: Partial<ActionCenterFilters>,
): ActionCenterFilters {
  const tabRaw = readParam(searchParams, "tab") ?? defaults?.tab ?? "active";
  const tab = VALID_TABS.has(tabRaw) ? (tabRaw as ActionCenterTab) : "active";

  const statusRaw = readParam(searchParams, "status");
  const priorityRaw = readParam(searchParams, "priority");
  const categoryRaw = readParam(searchParams, "category");

  const limitRaw = Number(readParam(searchParams, "limit") ?? "50");
  const offsetRaw = Number(readParam(searchParams, "offset") ?? "0");

  return {
    tab,
    status: statusRaw && VALID_STATUSES.has(statusRaw) ? (statusRaw as NextBestActionLifecycleStatus) : defaults?.status,
    priority:
      priorityRaw && VALID_PRIORITIES.has(priorityRaw) ? (priorityRaw as NextBestActionPriority) : defaults?.priority,
    category:
      categoryRaw && VALID_CATEGORIES.has(categoryRaw) ? (categoryRaw as NextBestActionCategory) : defaults?.category,
    entityType: readParam(searchParams, "entityType") ?? defaults?.entityType,
    companyId: readParam(searchParams, "company") ?? readParam(searchParams, "companyId") ?? defaults?.companyId,
    investorId: readParam(searchParams, "investor") ?? readParam(searchParams, "investorId") ?? defaults?.investorId,
    spvId: readParam(searchParams, "spv") ?? readParam(searchParams, "spvId") ?? defaults?.spvId,
    overdue: readParam(searchParams, "overdue") === "true" || defaults?.overdue,
    escalated: readParam(searchParams, "escalated") === "true" || defaults?.escalated,
    q: readParam(searchParams, "q") ?? defaults?.q,
    assignedToMe: readParam(searchParams, "assignedToMe") !== "false",
    limit: Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 50,
    offset: Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0,
  };
}

export function buildActionCenterHref(
  basePath: string,
  params: Partial<ActionCenterFilters> & { tab?: ActionCenterTab },
): string {
  const search = new URLSearchParams();
  if (params.tab) search.set("tab", params.tab);
  if (params.status) search.set("status", params.status);
  if (params.priority) search.set("priority", params.priority);
  if (params.category) search.set("category", params.category);
  if (params.entityType) search.set("entityType", params.entityType);
  if (params.companyId) search.set("company", params.companyId);
  if (params.investorId) search.set("investor", params.investorId);
  if (params.spvId) search.set("spv", params.spvId);
  if (params.overdue) search.set("overdue", "true");
  if (params.escalated) search.set("escalated", "true");
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function actionCenterBasePath(role: string): string {
  if (role === "investor") return "/investor/actions";
  if (role === "admin" || role === "analyst") return "/admin/actions";
  return "/founder/actions";
}

export type ActionCenterIntent = "overdue" | "critical" | "spv" | "escalated" | "general";

export function resolveActionCenterIntent(message: string): ActionCenterIntent | null {
  const lower = message.toLowerCase();
  if (
    lower.includes("overdue action") ||
    lower.includes("overdue actions") ||
    lower.includes("show my overdue") ||
    lower.includes("what is overdue")
  ) {
    return "overdue";
  }
  if (
    lower.includes("critical action") ||
    lower.includes("critical actions") ||
    lower.includes("what critical")
  ) {
    return "critical";
  }
  if (
    lower.includes("spv action") ||
    lower.includes("spv actions") ||
    lower.includes("spv pending") ||
    lower.includes("pending spv")
  ) {
    return "spv";
  }
  if (lower.includes("escalated action") || lower.includes("escalated actions")) {
    return "escalated";
  }
  if (lower.includes("action center") || lower.includes("my actions")) {
    return "general";
  }
  return null;
}

export function hrefForActionCenterIntent(role: string, intent: ActionCenterIntent): string {
  const base = actionCenterBasePath(role);
  switch (intent) {
    case "overdue":
      return buildActionCenterHref(base, { tab: "overdue", overdue: true });
    case "critical":
      return buildActionCenterHref(base, { priority: "critical" });
    case "spv":
      return buildActionCenterHref(base, { category: "spv" });
    case "escalated":
      return buildActionCenterHref(base, { tab: "escalated", escalated: true });
    default:
      return base;
  }
}
