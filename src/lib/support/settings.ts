/**
 * Support care settings: who on staff is notified, how reminders repeat until
 * a request is resolved, the promised reply time, and which AI jobs run.
 *
 * One JSON row in `platform_settings` (key `support_care`). Every read is
 * defensive: a missing row or table returns the defaults, and the defaults keep
 * today's behavior (the assigned staff member is notified, the founder
 * assistant keeps answering), plus reminders and the founder follow ups.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ONE_BUSINESS_DAY_HOURS } from "./business-hours";

export const SUPPORT_SETTINGS_KEY = "support_care";

export const REMINDER_INTERVALS = [1, 4, 8, 24] as const;
export type ReminderInterval = (typeof REMINDER_INTERVALS)[number];

export type SupportRecipient = { userId: string; inApp: boolean; email: boolean };

export type SupportCareSettings = {
  /** Events that notify the staff list. The assigned person is always notified. */
  notifyOnNew: boolean;
  notifyOnFounderReply: boolean;
  recipients: SupportRecipient[];
  reminders: { enabled: boolean; everyHours: ReminderInterval; businessHoursOnly: boolean };
  /** Promised first reply, in business hours (9 = one business day). */
  replyTargetHours: number;
  ai: {
    /** Tag topic and priority on every new request (internal only). */
    triage: boolean;
    /** Draft replies and resolve summaries for staff to edit. */
    drafts: boolean;
    /** The founder assistant answers how-to questions itself. Off = every
     *  question goes to a person. On by default because it already answers today. */
    answerFounders: boolean;
  };
};

export const DEFAULT_SUPPORT_SETTINGS: SupportCareSettings = {
  notifyOnNew: true,
  notifyOnFounderReply: true,
  recipients: [],
  reminders: { enabled: true, everyHours: 4, businessHoursOnly: true },
  replyTargetHours: ONE_BUSINESS_DAY_HOURS,
  ai: { triage: true, drafts: true, answerFounders: true },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** Fill gaps and clamp, so a hand edited row can never break sending. */
export function normalizeSupportSettings(raw: unknown): SupportCareSettings {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rem = (v.reminders && typeof v.reminders === "object" ? v.reminders : {}) as Record<string, unknown>;
  const ai = (v.ai && typeof v.ai === "object" ? v.ai : {}) as Record<string, unknown>;
  const d = DEFAULT_SUPPORT_SETTINGS;

  const seen = new Set<string>();
  const recipients: SupportRecipient[] = [];
  for (const r of Array.isArray(v.recipients) ? v.recipients : []) {
    const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const userId = typeof row.userId === "string" ? row.userId : "";
    if (!UUID.test(userId) || seen.has(userId)) continue;
    seen.add(userId);
    recipients.push({ userId, inApp: bool(row.inApp, true), email: bool(row.email, false) });
    if (recipients.length >= 25) break;
  }

  const every = Number(rem.everyHours);
  const target = Number(v.replyTargetHours);
  return {
    notifyOnNew: bool(v.notifyOnNew, d.notifyOnNew),
    notifyOnFounderReply: bool(v.notifyOnFounderReply, d.notifyOnFounderReply),
    recipients,
    reminders: {
      enabled: bool(rem.enabled, d.reminders.enabled),
      everyHours: (REMINDER_INTERVALS as readonly number[]).includes(every) ? (every as ReminderInterval) : d.reminders.everyHours,
      businessHoursOnly: bool(rem.businessHoursOnly, d.reminders.businessHoursOnly),
    },
    replyTargetHours: Number.isFinite(target) ? Math.min(45, Math.max(1, Math.round(target))) : d.replyTargetHours,
    ai: {
      triage: bool(ai.triage, d.ai.triage),
      drafts: bool(ai.drafts, d.ai.drafts),
      answerFounders: bool(ai.answerFounders, d.ai.answerFounders),
    },
  };
}

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function getSupportSettings(): Promise<SupportCareSettings> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", SUPPORT_SETTINGS_KEY).maybeSingle();
    return normalizeSupportSettings((data as { value?: unknown } | null)?.value);
  } catch {
    return normalizeSupportSettings(null);
  }
}

export async function saveSupportSettings(next: unknown, updatedBy: string | null): Promise<SupportCareSettings | null> {
  const clean = normalizeSupportSettings(next);
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert({ key: SUPPORT_SETTINGS_KEY, value: clean, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return error ? null : clean;
  } catch {
    return null;
  }
}
