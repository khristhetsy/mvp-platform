// Marketing-hub notification catalog. Types are code-defined (not user-created);
// adding one is a code change here + a re-seed of mkt_notification_types.
// This mirrors the settings UI and the migration seed exactly.

export type NotifKind = "alert" | "reminder";
export type Channel = "in_app" | "email" | "push";
export type NotifGroupId = "ai_cmo" | "compliance" | "ai_seo" | "campaigns" | "segments";

export interface NotifType {
  id: string; // stable key, e.g. "compliance.awaiting_review"
  group: NotifGroupId;
  label: string;
  description: string;
  kind: NotifKind;
  defaultChannels: Channel[];
  defaultOn: boolean;
  urgent: boolean; // urgent bypasses quiet hours for email/push
  supportsCadence: boolean; // reminders only
  defaultCadence?: string; // e.g. "daily_0630", "after_4h", "after_5d", "weekly_mon"
  /** Sample payload for the settings "live preview". */
  preview?: { title: string; body: string };
}

export const NOTIF_GROUPS: { id: NotifGroupId; label: string }[] = [
  { id: "ai_cmo", label: "AI CMO" },
  { id: "compliance", label: "Compliance gate" },
  { id: "ai_seo", label: "AI SEO" },
  { id: "campaigns", label: "Campaigns" },
  { id: "segments", label: "Segments" },
];

export const NOTIF_TYPES: NotifType[] = [
  // AI CMO
  {
    id: "cmo.brief_ready", group: "ai_cmo", label: "Morning brief ready",
    description: "Daily strategic brief from your AI CMO", kind: "reminder",
    defaultChannels: ["in_app", "email"], defaultOn: true, urgent: false,
    supportsCadence: true, defaultCadence: "daily_0630",
    preview: { title: "Your morning brief is ready", body: "3 moves for today: nurture the warm SaaS cohort, ship the AEO fix, review 2 queued assets." },
  },
  {
    id: "cmo.high_confidence", group: "ai_cmo", label: "New high-confidence recommendation",
    description: "When the CMO flags something worth acting on now", kind: "alert",
    defaultChannels: ["in_app"], defaultOn: true, urgent: false, supportsCadence: false,
    preview: { title: "High-confidence recommendation", body: "Re-send the March webinar invite to non-openers — modeled +18% RSVPs." },
  },

  // Compliance gate
  {
    id: "compliance.awaiting_review", group: "compliance", label: "Asset awaiting your review",
    description: "AI-drafted asset queued for the compliance gate", kind: "alert",
    defaultChannels: ["in_app", "email"], defaultOn: true, urgent: false, supportsCadence: false,
    preview: { title: "Asset awaiting review", body: "“Q2 Investor Update” email is queued at the compliance gate." },
  },
  {
    id: "compliance.violation_flagged", group: "compliance", label: "Register violation flagged",
    description: "AI caught outcome-register language before send", kind: "alert",
    defaultChannels: ["in_app"], defaultOn: true, urgent: true, supportsCadence: false,
    preview: { title: "Register violation flagged", body: "Draft used a returns claim. Blocked before send — open to revise." },
  },
  {
    id: "compliance.queue_stale", group: "compliance", label: "Reminder: queue not cleared",
    description: "Nudge if assets sit unreviewed too long", kind: "reminder",
    defaultChannels: ["in_app"], defaultOn: true, urgent: false,
    supportsCadence: true, defaultCadence: "after_4h",
    preview: { title: "Compliance queue not cleared", body: "2 assets have been waiting more than 4 hours." },
  },

  // AI SEO · AEO
  {
    id: "aiseo.citation_gained", group: "ai_seo", label: "New citation gained",
    description: "An AI platform started naming iCapOS", kind: "alert",
    defaultChannels: ["in_app"], defaultOn: true, urgent: false, supportsCadence: false,
    preview: { title: "New citation gained", body: "Perplexity now names iCapOS for “fund admin for SPVs.”" },
  },
  {
    id: "aiseo.citation_lost", group: "ai_seo", label: "Citation lost / competitor overtook",
    description: "You dropped from an answer, or a rival took the slot", kind: "alert",
    defaultChannels: ["in_app", "email"], defaultOn: true, urgent: false, supportsCadence: false,
    preview: { title: "Citation lost", body: "You dropped from ChatGPT's answer for “cap table software” — a competitor took the slot." },
  },
  {
    id: "aiseo.weekly_report", group: "ai_seo", label: "Weekly visibility report",
    description: "Share-of-model summary across tracked prompts", kind: "reminder",
    defaultChannels: ["email"], defaultOn: true, urgent: false,
    supportsCadence: true, defaultCadence: "weekly_mon",
    preview: { title: "Weekly visibility report", body: "Share of model 34% (+5pts). You lead 11 of 30 tracked prompts." },
  },

  // Campaigns
  {
    id: "campaigns.batch_complete", group: "campaigns", label: "Batch send complete",
    description: "A campaign batch finished sending", kind: "alert",
    defaultChannels: ["in_app"], defaultOn: false, urgent: false, supportsCadence: false,
    preview: { title: "Batch send complete", body: "“June Founder Digest” finished — 2,140 delivered." },
  },
  {
    id: "campaigns.deliverability_drop", group: "campaigns", label: "Open / deliverability drop",
    description: "Performance fell below your threshold", kind: "alert",
    defaultChannels: ["in_app", "email"], defaultOn: true, urgent: true, supportsCadence: false,
    preview: { title: "Deliverability drop", body: "Open rate fell to 11% on the last send — below your 18% threshold." },
  },

  // Segments
  {
    id: "segments.warm_idle", group: "segments", label: "Warm cohort going idle",
    description: "Your warmest segment hasn't been worked", kind: "reminder",
    defaultChannels: ["in_app"], defaultOn: true, urgent: false,
    supportsCadence: true, defaultCadence: "after_5d",
    preview: { title: "Warm cohort going idle", body: "“Engaged founders” hasn't been worked in 5 days." },
  },
  {
    id: "segments.investor_untouched", group: "segments", label: "Investor list untouched",
    description: "Supply-side risk in the two-sided base", kind: "reminder",
    defaultChannels: ["in_app"], defaultOn: true, urgent: false,
    supportsCadence: true, defaultCadence: "after_7d",
    preview: { title: "Investor list untouched", body: "The investor segment hasn't been contacted in 7 days." },
  },
];

const BY_ID = new Map(NOTIF_TYPES.map((t) => [t.id, t]));
export function getNotifType(id: string): NotifType | undefined {
  return BY_ID.get(id);
}

export const CHANNELS: Channel[] = ["in_app", "email", "push"];
export const CHANNEL_LABELS: Record<Channel, string> = {
  in_app: "In-app",
  email: "Email",
  push: "Push",
};
