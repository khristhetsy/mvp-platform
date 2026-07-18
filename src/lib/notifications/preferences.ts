import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type NotificationEventKey =
  | "new_founder_signup"
  | "stage_approval_request"
  | "compliance_escalation"
  | "remediation_overdue"
  | "investor_interest"
  | "intro_request"
  | "spv_blocker"
  | "document_uploaded"
  | "readiness_rescored"
  | "strong_investor_match";

export type NotificationChannel = "in_app" | "email" | "digest";

export type EventChannelPref = { in_app: boolean; email: boolean; digest: boolean };

export type NotificationPrefs = {
  events: Record<string, EventChannelPref>;
  digest_frequency: "daily" | "weekly" | "off";
  quiet_start: string | null;
  quiet_end: string | null;
  pause_all: boolean;
  critical_override: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_slack: boolean;
};

const DEFAULT_EVENT: EventChannelPref = { in_app: true, email: true, digest: false };

export const DEFAULT_PREFS: NotificationPrefs = {
  events: {
    new_founder_signup: { in_app: true, email: true, digest: true },
    stage_approval_request: { in_app: true, email: true, digest: false },
    compliance_escalation: { in_app: true, email: true, digest: false },
    remediation_overdue: { in_app: true, email: false, digest: true },
    investor_interest: { in_app: true, email: true, digest: false },
    intro_request: { in_app: true, email: true, digest: false },
    spv_blocker: { in_app: true, email: true, digest: false },
    document_uploaded: { in_app: true, email: false, digest: true },
    readiness_rescored: { in_app: false, email: false, digest: true },
    strong_investor_match: { in_app: true, email: true, digest: false },
  },
  digest_frequency: "weekly",
  quiet_start: "20:00",
  quiet_end: "07:00",
  pause_all: false,
  critical_override: true,
  channel_in_app: true,
  channel_email: true,
  channel_slack: false,
};

// Maps the platform's NotificationType values onto the 9 user-facing event keys.
// Types not listed here are NOT gated by preferences (delivered as before).
const TYPE_TO_EVENT: Record<string, NotificationEventKey> = {
  founder_onboarding_completed: "new_founder_signup",
  compliance_event_created: "compliance_escalation",
  remediation_task_created: "remediation_overdue",
  investor_expressed_interest: "investor_interest",
  investor_pledge_submitted: "investor_interest",
  investor_intro_requested: "intro_request",
  investor_follow_up_requested: "intro_request",
  founder_pipeline_intro_requested: "intro_request",
  intro_facilitated: "intro_request",
  intro_facilitated_founder: "intro_request",
  spv_requirements_requested: "spv_blocker",
  spv_investor_documents_pending_review: "spv_blocker",
  spv_ready_for_final_review: "spv_blocker",
  spv_ready_for_legal_docs: "spv_blocker",
  spv_requirement_uploaded: "document_uploaded",
  spv_document_ready: "document_uploaded",
  deal_room_document_requested: "document_uploaded",
  strong_investor_match: "strong_investor_match",
};

export function mapNotificationTypeToEvent(type: string): NotificationEventKey | null {
  return TYPE_TO_EVENT[type] ?? null;
}

function isCritical(severity?: string | null): boolean {
  return severity === "critical";
}

/** True if `now` (UTC) falls within the user's quiet-hours window. */
export function isQuietNow(prefs: NotificationPrefs, now: Date = new Date()): boolean {
  if (!prefs.quiet_start || !prefs.quiet_end) return false;
  const [sh, sm] = prefs.quiet_start.split(":").map(Number);
  const [eh, em] = prefs.quiet_end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

export async function loadNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  try {
    const admin = createServiceRoleClient() as unknown as SupabaseClient;
    const { data } = await admin
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return DEFAULT_PREFS;
    const row = data as Record<string, unknown>;
    return {
      events: (row.events as Record<string, EventChannelPref>) ?? DEFAULT_PREFS.events,
      digest_frequency: (row.digest_frequency as NotificationPrefs["digest_frequency"]) ?? "weekly",
      quiet_start: (row.quiet_start as string | null) ?? null,
      quiet_end: (row.quiet_end as string | null) ?? null,
      pause_all: Boolean(row.pause_all),
      critical_override: row.critical_override === undefined ? true : Boolean(row.critical_override),
      channel_in_app: row.channel_in_app === undefined ? true : Boolean(row.channel_in_app),
      channel_email: row.channel_email === undefined ? true : Boolean(row.channel_email),
      channel_slack: Boolean(row.channel_slack),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Whether a channel is allowed for a given event, honoring pause-all,
 * the critical override, and the global + per-event channel switches.
 * Quiet hours are NOT applied to in-app (passive); callers gating email
 * should additionally check `isQuietNow`.
 */
export function channelAllowed(
  prefs: NotificationPrefs,
  eventKey: NotificationEventKey,
  channel: NotificationChannel,
  severity?: string | null,
): boolean {
  const critical = isCritical(severity);
  if (prefs.pause_all && !(critical && prefs.critical_override)) return false;
  if (channel === "in_app" && !prefs.channel_in_app) return false;
  if (channel === "email" && !prefs.channel_email) return false;
  const ev = prefs.events[eventKey] ?? DEFAULT_EVENT;
  return ev[channel];
}

/** Convenience: should this in-app notification be created for the recipient? */
export async function shouldDeliverInApp(
  userId: string,
  type: string,
  severity?: string | null,
): Promise<boolean> {
  const eventKey = mapNotificationTypeToEvent(type);
  if (!eventKey) return true; // no user toggle for this type — deliver as before
  const prefs = await loadNotificationPrefs(userId);
  return channelAllowed(prefs, eventKey, "in_app", severity);
}

/** Convenience for email senders (wire per-sender): respects quiet hours. */
export async function shouldSendEmail(
  userId: string,
  type: string,
  severity?: string | null,
  now: Date = new Date(),
): Promise<boolean> {
  const eventKey = mapNotificationTypeToEvent(type);
  if (!eventKey) return true;
  const prefs = await loadNotificationPrefs(userId);
  if (!channelAllowed(prefs, eventKey, "email", severity)) return false;
  if (isQuietNow(prefs, now) && !(isCritical(severity) && prefs.critical_override)) return false;
  return true;
}
