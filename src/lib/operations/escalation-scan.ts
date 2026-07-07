// Read-only escalation scan for the Operations Hub. Mirrors the read queries in
// runOperationsEscalations() but never notifies or mutates — safe to call on page
// load. Adapts to the existing notification-based escalation model (no audit table).

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listEngagements } from "@/lib/diligence/data";
import { getOpsSettings } from "@/lib/operations/settings";
import { daysSince } from "@/lib/operations/escalations";

const DD_ACTIVE = ["sent_to_founder", "responding", "admin_review", "consent_requested", "consented_locked"];

export interface OpenEscalation {
  id: string;
  kind: "onboarding" | "diligence";
  name: string;
  daysOverdue: number;
  isUrgent: boolean;
  href: string;
}

/** Companies/engagements currently past their SLA. Urgent = ≥ 2× the SLA window. */
export async function scanOpenEscalations(): Promise<OpenEscalation[]> {
  const admin = createServiceRoleClient();
  const s = await getOpsSettings();
  const out: OpenEscalation[] = [];

  try {
    const { data: companies } = await admin
      .from("companies")
      .select("id, company_name, updated_at, onboarding_completed_at")
      .is("onboarding_completed_at", null);
    for (const c of (companies ?? []) as Array<{ id: string; company_name: string | null; updated_at: string | null }>) {
      const od = daysSince(c.updated_at);
      if (od < s.onboardingSlaDays) continue;
      out.push({ id: c.id, kind: "onboarding", name: c.company_name ?? "Company", daysOverdue: od, isUrgent: od >= s.onboardingSlaDays * 2, href: `/admin/companies/${c.id}` });
    }
  } catch { /* table shape differs → skip */ }

  try {
    const engagements = await listEngagements(admin).catch(() => []);
    for (const e of engagements) {
      if (!DD_ACTIVE.includes(e.lifecycle_stage)) continue;
      const od = daysSince(e.updated_at);
      if (od < s.diligenceSlaDays) continue;
      out.push({ id: e.id, kind: "diligence", name: e.company_name ?? "Engagement", daysOverdue: od, isUrgent: od >= s.diligenceSlaDays * 2, href: "/admin/diligence" });
    }
  } catch { /* skip */ }

  return out.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Onboarding companies about to breach SLA (within `window` days) — nudge candidates. */
export async function scanNearBreachOnboarding(windowDays = 3): Promise<Array<{ id: string; name: string; daysIdle: number }>> {
  const admin = createServiceRoleClient();
  const s = await getOpsSettings();
  const out: Array<{ id: string; name: string; daysIdle: number }> = [];
  try {
    const { data: companies } = await admin
      .from("companies")
      .select("id, company_name, updated_at, onboarding_completed_at")
      .is("onboarding_completed_at", null);
    for (const c of (companies ?? []) as Array<{ id: string; company_name: string | null; updated_at: string | null }>) {
      const idle = daysSince(c.updated_at);
      if (idle >= s.onboardingSlaDays - windowDays && idle < s.onboardingSlaDays) {
        out.push({ id: c.id, name: c.company_name ?? "Company", daysIdle: idle });
      }
    }
  } catch { /* skip */ }
  return out.sort((a, b) => b.daysIdle - a.daysIdle);
}
