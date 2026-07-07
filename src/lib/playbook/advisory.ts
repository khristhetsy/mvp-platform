// AI Ops Advisory — deterministic rule engine (v1, not LLM). Computes suggestions
// from live signals; copy comes from templates. The advisory NEVER mutates data:
// every action is a link or an explicit-click admin API call. Dismiss/snooze state
// persists in ops_advisory_actions; suggestions themselves are computed each time.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import type { OpenEscalation } from "@/lib/operations/escalation-scan";

const db = serviceRoleClientUntyped;

export interface AdvisoryAction {
  label: string;
  kind: "link" | "api";
  href?: string;
  endpoint?: string;
  payload?: Record<string, unknown>;
}
export interface Suggestion {
  key: string;
  title: string;
  detail: string;
  priority: number;
  actions: AdvisoryAction[];
}

export interface AdvisoryContext {
  escalations: OpenEscalation[];
  nearBreach: Array<{ id: string; name: string; daysIdle: number }>;
  counts: Record<string, number>;
  gateSurfacesUnchecked: Array<{ navId: string; label: string; href: string }>;
  hourLocal: number;
  today: string;
}

const QUEUE_LABEL: Record<string, { label: string; href: string }> = {
  events_pending_applications: { label: "events", href: "/admin/events" },
  intro_requests_pending: { label: "intro request", href: "/admin/intro-requests" },
  investors_pending_kyc: { label: "investor KYC", href: "/admin/investors" },
};

const DISMISS = { label: "Dismiss", kind: "api" as const, endpoint: "/api/admin/playbook/advisory/action" };
const SNOOZE = { label: "Snooze 1 day", kind: "api" as const, endpoint: "/api/admin/playbook/advisory/action" };

function build(ctx: AdvisoryContext): Suggestion[] {
  const out: Suggestion[] = [];
  const urgent = ctx.escalations.filter((e) => e.isUrgent);

  // Rule 1 + 2 — urgent escalations, most overdue first.
  urgent.forEach((e, i) => {
    out.push({
      key: `escalation:${e.kind}:${e.id}`,
      title: i === 0 ? `Work ${e.name}'s escalation first` : `Urgent: ${e.name} is ${e.daysOverdue} days overdue`,
      detail: `${e.kind === "onboarding" ? "Onboarding" : "Diligence"} for ${e.name} is ${e.daysOverdue} days past its SLA. It needs a manager to unblock it.`,
      priority: i === 0 ? 100 : 90 - i,
      actions: [{ label: "Open", kind: "link", href: e.href }, DISMISS],
    });
  });

  // Rule 3 — queue SLA pressure (any pending queue above 0).
  for (const [src, n] of Object.entries(ctx.counts)) {
    if (n <= 0 || !QUEUE_LABEL[src]) continue;
    const q = QUEUE_LABEL[src];
    out.push({
      key: `queue:${src}:${ctx.today}`,
      title: `${n} ${q.label} ${n === 1 ? "item is" : "items are"} pending`,
      detail: `The ${q.label} queue has ${n} item${n === 1 ? "" : "s"} waiting. Work them down before they age out.`,
      priority: 70,
      actions: [{ label: "Open", kind: "link", href: q.href }, SNOOZE],
    });
  }

  // Rule 4 — stalling onboarding, about to escalate → manual nudge.
  ctx.nearBreach.slice(0, 2).forEach((c) => {
    out.push({
      key: `nudge:${c.id}`,
      title: `${c.name} may avoid escalation with a manual nudge`,
      detail: `Idle ${c.daysIdle} days — approaching the onboarding SLA. A manual reminder now can keep it from escalating.`,
      priority: 60,
      actions: [
        { label: "Nudge now", kind: "api", endpoint: "/api/admin/onboarding/nudge", payload: { companyId: c.id } },
        { label: "Open", kind: "link", href: `/admin/companies/${c.id}` },
        DISMISS,
      ],
    });
  });

  // Rule 5 — unworked gate late in the local day.
  if (ctx.hourLocal >= 15) {
    for (const g of ctx.gateSurfacesUnchecked) {
      out.push({
        key: `gate:${g.navId}:${ctx.today}`,
        title: `Gate surface "${g.label}" not yet worked today`,
        detail: `It's past 15:00 and this hard-gate surface hasn't been checked in today's run. Gates are hard stops.`,
        priority: 50,
        actions: [{ label: "Go to surface", kind: "link", href: g.href }],
      });
    }
  }

  return out;
}

/** Compute up to 5 active suggestions, filtered by the admin's dismiss/snooze state. */
export async function computeSuggestions(adminId: string, ctx: AdvisoryContext): Promise<Suggestion[]> {
  const all = build(ctx);

  // Filter out dismissed / still-snoozed suggestions for this admin.
  const suppressed = new Set<string>();
  try {
    const { data } = await db().from("ops_advisory_actions").select("suggestion_key, action, snooze_until").eq("admin_id", adminId);
    const now = Date.now();
    for (const r of (data ?? []) as Array<{ suggestion_key: string; action: string; snooze_until: string | null }>) {
      if (r.action === "dismissed") suppressed.add(r.suggestion_key);
      else if (r.action === "snoozed" && r.snooze_until && new Date(r.snooze_until).getTime() > now) suppressed.add(r.suggestion_key);
    }
  } catch { /* no table yet → show all */ }

  return all
    .filter((s) => !suppressed.has(s.key))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}
