import type { OperationalEventSeverity } from "@/lib/operational-activity/types";
import type { NextBestActionRole } from "@/lib/next-best-actions/types";

export const SCHEDULED_DIGEST_TYPES = [
  "admin_daily_digest",
  "founder_weekly_digest",
  "investor_weekly_digest",
  "critical_overdue_digest",
  "spv_blocker_digest",
  "compliance_attention_digest",
] as const;

export type ScheduledDigestType = (typeof SCHEDULED_DIGEST_TYPES)[number];

export const REMINDER_TYPES = [
  "reminder",
  "follow_up",
  "escalation_warning",
  "inactivity_warning",
  "workflow_attention",
] as const;

export type ReminderKind = (typeof REMINDER_TYPES)[number];

export type DigestSectionKey =
  | "critical"
  | "overdue"
  | "escalated"
  | "blocked"
  | "inactivity"
  | "recommended";

export type ScheduledDigestSection = {
  key: DigestSectionKey;
  label: string;
  items: ScheduledDigestItem[];
};

export type ScheduledDigestItem = {
  id: string;
  title: string;
  severity: OperationalEventSeverity;
  deepLink?: string | null;
  actionId?: string | null;
  priority?: string;
  category?: string;
};

export type ScheduledDigest = {
  digestType: ScheduledDigestType;
  title: string;
  role: NextBestActionRole | "founder" | "investor" | "admin";
  userId?: string | null;
  generatedAt: string;
  sections: ScheduledDigestSection[];
  counts: {
    critical: number;
    overdue: number;
    escalated: number;
    blocked: number;
    inactivity: number;
    recommended: number;
    total: number;
  };
  attentionAreas: string[];
  primaryDeepLink: string;
};

export type ScheduledReminder = {
  kind: ReminderKind;
  trigger: string;
  title: string;
  message: string;
  recipientUserId: string;
  severity: OperationalEventSeverity;
  dedupeKey: string;
  deepLink?: string | null;
  actionId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export type ScheduledDigestPassResult = {
  digestsGenerated: number;
  remindersSent: number;
  remindersSkipped: number;
  notificationsCreated: number;
  eventsEmitted: number;
  runs: Array<{ digestType: ScheduledDigestType; runId: string; userId: string | null; itemCount: number }>;
};

export type ActionCenterScheduledContext = {
  digestBanner: {
    title: string;
    summary: string;
    deepLink: string;
    generatedAt: string | null;
  } | null;
  recentlyReminded: Array<{ title: string; deepLink: string | null; createdAt: string }>;
  returningFromSnooze: Array<{ id: string; title: string; deepLink: string }>;
  needsFollowUp: Array<{ id: string; title: string; deepLink: string; reason: string }>;
};

export type ScheduledOperationalCounts = {
  reminderCount: number;
  digestCount: number;
  followUpCount: number;
  staleWorkflowCount: number;
  repeatedOverdueCount: number;
};
