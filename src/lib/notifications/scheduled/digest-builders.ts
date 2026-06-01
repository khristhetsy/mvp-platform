import { actionCenterBasePath } from "@/lib/actions/filters";
import { isActionOverdue } from "@/lib/notifications/orchestration/due-dates";
import type {
  DigestSectionKey,
  ScheduledDigest,
  ScheduledDigestItem,
  ScheduledDigestSection,
  ScheduledDigestType,
} from "@/lib/notifications/scheduled/types";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";

export const MAX_DIGEST_ITEMS = 50;

function capItems<T>(items: T[], max: number): T[] {
  return items.slice(0, max);
}

function rowToItem(row: NextBestActionRecord, severity: ScheduledDigestItem["severity"]): ScheduledDigestItem {
  return {
    id: row.id,
    title: row.title,
    severity,
    deepLink: row.href ?? actionCenterBasePath(row.role),
    actionId: row.id,
    priority: row.priority,
    category: row.category,
  };
}

function buildSections(rows: NextBestActionRecord[], inactivityTitles: string[] = []): ScheduledDigestSection[] {
  const active = rows.filter((r) => ["open", "overdue", "blocked", "escalated"].includes(r.status));

  const critical = capItems(
    active.filter((r) => r.priority === "critical").map((r) => rowToItem(r, "critical")),
    12,
  );
  const overdue = capItems(
    active.filter((r) => isActionOverdue(r)).map((r) => rowToItem(r, "high")),
    12,
  );
  const escalated = capItems(
    active.filter((r) => r.status === "escalated").map((r) => rowToItem(r, "high")),
    10,
  );
  const blocked = capItems(
    active.filter((r) => r.status === "blocked").map((r) => rowToItem(r, "medium")),
    10,
  );
  const inactivity: ScheduledDigestItem[] = capItems(
    inactivityTitles.map((title, i) => ({
      id: `inactivity-${i}`,
      title,
      severity: "medium" as const,
      deepLink: null,
    })),
    8,
  );
  const recommended = capItems(
    active
      .filter((r) => r.status === "open" && !isActionOverdue(r))
      .map((r) => rowToItem(r, "info")),
    8,
  );

  const sections: ScheduledDigestSection[] = [];
  if (critical.length) sections.push({ key: "critical", label: "Critical actions", items: critical });
  if (overdue.length) sections.push({ key: "overdue", label: "Overdue actions", items: overdue });
  if (escalated.length) sections.push({ key: "escalated", label: "Escalated workflows", items: escalated });
  if (blocked.length) sections.push({ key: "blocked", label: "Blocked workflows", items: blocked });
  if (inactivity.length) sections.push({ key: "inactivity", label: "Workflow inactivity", items: inactivity });
  if (recommended.length) sections.push({ key: "recommended", label: "Recommended next", items: recommended });

  return sections;
}

function countSection(sections: ScheduledDigestSection[], key: DigestSectionKey): number {
  return sections.find((s) => s.key === key)?.items.length ?? 0;
}

function attentionAreas(sections: ScheduledDigestSection[]): string[] {
  const areas: string[] = [];
  if (countSection(sections, "critical")) areas.push("Critical compliance and priority reviews");
  if (countSection(sections, "overdue")) areas.push("Overdue operational actions");
  if (countSection(sections, "blocked")) areas.push("Blocked SPV or workflow items");
  if (countSection(sections, "inactivity")) areas.push("Inactive onboarding or approvals");
  if (countSection(sections, "escalated")) areas.push("Escalated workflows needing follow-up");
  return areas;
}

function totalItems(sections: ScheduledDigestSection[]): number {
  return Math.min(
    MAX_DIGEST_ITEMS,
    sections.reduce((sum, s) => sum + s.items.length, 0),
  );
}

function baseDigest(
  digestType: ScheduledDigestType,
  title: string,
  role: ScheduledDigest["role"],
  sections: ScheduledDigestSection[],
  userId?: string | null,
): ScheduledDigest {
  const primaryDeepLink =
    role === "founder"
      ? "/founder/actions"
      : role === "investor"
        ? "/investor/actions"
        : "/admin/actions";

  return {
    digestType,
    title,
    role,
    userId: userId ?? null,
    generatedAt: new Date().toISOString(),
    sections,
    counts: {
      critical: countSection(sections, "critical"),
      overdue: countSection(sections, "overdue"),
      escalated: countSection(sections, "escalated"),
      blocked: countSection(sections, "blocked"),
      inactivity: countSection(sections, "inactivity"),
      recommended: countSection(sections, "recommended"),
      total: totalItems(sections),
    },
    attentionAreas: attentionAreas(sections),
    primaryDeepLink,
  };
}

export function buildAdminScheduledDigest(rows: NextBestActionRecord[], inactivityTitles: string[] = []): ScheduledDigest {
  const adminRows = rows.filter((r) => r.role === "admin" || r.role === "analyst");
  const sections = buildSections(adminRows, inactivityTitles);
  return baseDigest("admin_daily_digest", "Admin daily operational digest", "admin", sections, null);
}

export function buildFounderScheduledDigest(
  rows: NextBestActionRecord[],
  userId: string,
  inactivityTitles: string[] = [],
): ScheduledDigest {
  const founderRows = rows.filter((r) => r.user_id === userId && r.role === "founder");
  const sections = buildSections(founderRows, inactivityTitles);
  return baseDigest("founder_weekly_digest", "Founder weekly workflow digest", "founder", sections, userId);
}

export function buildInvestorScheduledDigest(
  rows: NextBestActionRecord[],
  userId: string,
  inactivityTitles: string[] = [],
): ScheduledDigest {
  const investorRows = rows.filter((r) => r.user_id === userId && r.role === "investor");
  const sections = buildSections(investorRows, inactivityTitles);
  return baseDigest("investor_weekly_digest", "Investor weekly workflow digest", "investor", sections, userId);
}

export function buildCriticalOverdueDigest(rows: NextBestActionRecord[]): ScheduledDigest {
  const overdue = rows.filter((r) => isActionOverdue(r) && (r.priority === "critical" || r.category === "compliance"));
  const sections = buildSections(overdue);
  return baseDigest("critical_overdue_digest", "Critical overdue digest", "admin", sections, null);
}

export function buildSpvBlockerDigest(rows: NextBestActionRecord[]): ScheduledDigest {
  const spvRows = rows.filter(
    (r) => r.category === "spv" || r.status === "blocked" || r.action_type.includes("spv"),
  );
  const sections = buildSections(spvRows);
  return baseDigest("spv_blocker_digest", "SPV blocker digest", "admin", sections, null);
}

export function buildComplianceAttentionDigest(rows: NextBestActionRecord[]): ScheduledDigest {
  const complianceRows = rows.filter((r) => r.category === "compliance" || r.priority === "critical");
  const sections = buildSections(complianceRows);
  return baseDigest("compliance_attention_digest", "Compliance attention digest", "admin", sections, null);
}

export function formatScheduledDigestSummary(digest: ScheduledDigest): string {
  const lines = [
    digest.title,
    `Total items: ${digest.counts.total}`,
    ...digest.attentionAreas.map((a) => `• ${a}`),
  ];
  for (const section of digest.sections.slice(0, 4)) {
    if (section.items.length) {
      lines.push(`${section.label}: ${section.items.map((i) => i.title).join("; ")}`);
    }
  }
  return lines.join("\n");
}
