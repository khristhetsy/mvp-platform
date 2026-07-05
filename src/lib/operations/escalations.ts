// Operations escalations — the "fail-proof" backstop. Scans onboarding and
// due-diligence items, and when one breaches its SLA, notifies the manager/staff
// pool (deduped per item per day). Run from a cron. v1 notifies the staff pool;
// v2 will add a single named owner + reassign + email.

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listEngagements } from "@/lib/diligence/data";
import { notifyStaffIfNotRecent, createNotification } from "@/lib/notifications/notifications";
import { getOpsSettings } from "@/lib/operations/settings";

// Defaults used by the hub badges; the escalation scan reads live settings.
export const ONBOARDING_SLA_DAYS = 7;
export const DILIGENCE_SLA_DAYS = 3;
const DD_ACTIVE = ["sent_to_founder", "responding", "admin_review", "consent_requested", "consented_locked"];
const DAY_MS = 86_400_000;

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

export interface EscalationResult { onboarding: number; diligence: number; scanned: number }

/** Scan and escalate any past-due onboarding / diligence items. Idempotent per day. */
export async function runOperationsEscalations(): Promise<EscalationResult> {
  const admin = createServiceRoleClient();
  const settings = await getOpsSettings();
  let onboarding = 0;
  let diligence = 0;
  let scanned = 0;

  // Route to the configured default manager, else the whole staff pool (deduped).
  async function escalate(p: { title: string; message: string; entityType: string; entityId: string; deepLink: string }) {
    if (settings.defaultManagerId) {
      await createNotification({ recipientUserId: settings.defaultManagerId, type: "operations.escalation", severity: "high", ...p });
    } else {
      await notifyStaffIfNotRecent({ type: "operations.escalation", severity: "high", withinHours: 24, ...p });
    }
  }

  // --- Onboarding overdue (incomplete for > SLA days) ---
  const { data: companies } = await admin
    .from("companies")
    .select("id, company_name, onboarding_progress_percent, onboarding_completed_at, updated_at")
    .is("onboarding_completed_at", null);

  for (const c of (companies ?? []) as Array<{ id: string; company_name: string | null; onboarding_progress_percent: number | null; onboarding_completed_at: string | null; updated_at: string | null }>) {
    scanned++;
    const overdue = daysSince(c.updated_at);
    if (overdue < settings.onboardingSlaDays) continue;
    await escalate({
      title: `Onboarding overdue — ${c.company_name ?? "Company"}`,
      message: `Onboarding is ${overdue} days past the ${settings.onboardingSlaDays}-day SLA (stuck at ${Math.round(c.onboarding_progress_percent ?? 0)}%). A manager needs to unblock it.`,
      entityType: "company",
      entityId: c.id,
      deepLink: `/admin/companies/${c.id}`,
    });
    onboarding++;
  }

  // --- Diligence stalled (active stage untouched for > SLA days) ---
  const engagements = await listEngagements(admin).catch(() => []);
  for (const e of engagements) {
    if (!DD_ACTIVE.includes(e.lifecycle_stage)) continue;
    scanned++;
    const overdue = daysSince(e.updated_at);
    if (overdue < settings.diligenceSlaDays) continue;
    await escalate({
      title: `Diligence stalled — ${e.company_name ?? "Engagement"}`,
      message: `Sat in "${e.lifecycle_stage}" for ${overdue} days (SLA ${settings.diligenceSlaDays}). Confidence ${e.confidence_pct ?? 0}%. A manager needs to move it forward.`,
      entityType: "dd_engagement",
      entityId: e.id,
      deepLink: `/admin/diligence`,
    });
    diligence++;
  }

  return { onboarding, diligence, scanned };
}
