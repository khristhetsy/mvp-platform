import { getDrilldownHref } from "@/lib/ui/drilldown-links";
import { OPERATIONAL_CATEGORY_LABELS } from "@/lib/operational-activity/event-categories";
import type { OperationalActivityFeedItem, OperationalEventCategory } from "@/lib/operational-activity/types";

const CATEGORY_ICONS: Record<OperationalEventCategory, string> = {
  crm: "◆",
  onboarding: "◎",
  diligence: "▣",
  compliance: "⚠",
  spv: "SPV",
  investor: "●",
  founder: "★",
  reporting: "▤",
  messaging: "✉",
  outreach: "→",
  system: "⚙",
  imports: "↑",
  analytics: "▥",
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  investor_interest_expressed: "●",
  investor_intro_requested: "→",
  investor_deal_saved: "◆",
  spv_status_changed: "SPV",
  spv_readiness_updated: "✓",
  compliance_event_created: "⚠",
  import_previewed: "↑",
  import_completed: "✓",
  export_generated: "↓",
  report_generated: "▤",
  founder_onboarding_completed: "◎",
};

export function getOperationalCategoryIcon(category: OperationalEventCategory): string {
  return CATEGORY_ICONS[category] ?? "·";
}

export function getOperationalEventIcon(eventType: string, category: OperationalEventCategory): string {
  return EVENT_TYPE_ICONS[eventType] ?? getOperationalCategoryIcon(category);
}

export function getOperationalCategoryLabel(category: OperationalEventCategory): string {
  return OPERATIONAL_CATEGORY_LABELS[category] ?? category;
}

export function formatOperationalEventType(eventType: string): string {
  return eventType
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatOperationalTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function getOperationalEventHref(item: OperationalActivityFeedItem): string {
  switch (item.event_category) {
    case "crm":
    case "investor":
      if (item.event_type.includes("interest")) return getDrilldownHref("investor_interests");
      if (item.event_type.includes("intro")) return getDrilldownHref("intro_requests");
      if (item.event_type.includes("saved")) return getDrilldownHref("saved_deals");
      return "/admin/crm";
    case "compliance":
      return item.severity === "critical"
        ? getDrilldownHref("compliance_critical")
        : getDrilldownHref("compliance_open");
    case "spv":
      return getDrilldownHref("spv_recent");
    case "reporting":
      return getDrilldownHref("reports");
    case "imports":
      return "/admin/imports";
    case "onboarding":
    case "founder":
      return item.company_id ? `/admin/companies?company=${item.company_id}` : "/admin/companies";
    default:
      return "/admin/dashboard";
  }
}

export function getOperationalEventSubtitle(item: OperationalActivityFeedItem): string | null {
  if (item.company_name) return item.company_name;
  if (item.actor_name) return item.actor_name;
  return item.source_module;
}

/** Group feed items by category for compact timeline rendering. */
export function groupOperationalFeedByCategory(items: OperationalActivityFeedItem[]) {
  const groups = new Map<OperationalEventCategory, OperationalActivityFeedItem[]>();

  for (const item of items) {
    const list = groups.get(item.event_category) ?? [];
    list.push(item);
    groups.set(item.event_category, list);
  }

  return [...groups.entries()].sort((a, b) => {
    const aTime = a[1][0]?.created_at ?? "";
    const bTime = b[1][0]?.created_at ?? "";
    return bTime.localeCompare(aTime);
  });
}
