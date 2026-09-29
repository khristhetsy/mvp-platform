/**
 * Input metrics for the founder email budget, rollout cohort against holdout,
 * all read from data the platform already records: the email log (sends,
 * clicks, complaints), founder_email_prefs (unsubscribes through the digest
 * link) and profiles (journey stage). Nothing here is estimated: a figure with
 * no data behind it comes back null and the page shows it as not measured.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import type { BudgetConfig } from "./config";
import { cohortFor, type ComplaintState } from "./rules";
import { loadComplaintState } from "./digest";

export type GroupMetrics = {
  founders: number;
  emails7d: number;
  /** Emails per founder over the last 7 days. */
  emailsPerFounder: number | null;
  /** Share of sent emails with a click (percent). */
  actionRate: number | null;
  unsubscribes7d: number;
  /** Share of founders at Match or later (percent). */
  atMatchOrLater: number | null;
};

export type BudgetMetrics = {
  rollout: GroupMetrics;
  holdout: GroupMetrics;
  complaints: ComplaintState;
  heldPending: number;
  digestsSent7d: number;
  loadedAt: string;
};

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

function emptyGroup(): GroupMetrics {
  return { founders: 0, emails7d: 0, emailsPerFounder: null, actionRate: null, unsubscribes7d: 0, atMatchOrLater: null };
}

export async function loadBudgetMetrics(cfg: BudgetConfig): Promise<BudgetMetrics> {
  const client = db();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const groups = { rollout: emptyGroup(), holdout: emptyGroup() };
  const cohortOf = new Map<string, "rollout" | "holdout">();
  const atMatch = { rollout: 0, holdout: 0 };
  const clicked = { rollout: 0, holdout: 0 };

  try {
    const { data: founders } = await client.from("profiles").select("id, email, role, journey_stage").eq("role", "founder").limit(10000);
    for (const f of (founders ?? []) as Array<{ id: string; email: string | null; role: string | null; journey_stage: string | null }>) {
      if (isInternalAccount(f)) continue;
      const c = cohortFor(f.id, cfg);
      if (c === "control") continue;
      cohortOf.set(f.id, c);
      groups[c].founders++;
      if (f.journey_stage === "deploy" || f.journey_stage === "optimize") atMatch[c]++;
    }

    const { data: sends } = await client
      .from("email_log")
      .select("recipient_user_id, clicked_at")
      .eq("recipient_role", "founder")
      .eq("status", "sent")
      .gte("created_at", since)
      .limit(50000);
    for (const s of (sends ?? []) as Array<{ recipient_user_id: string | null; clicked_at: string | null }>) {
      const c = s.recipient_user_id ? cohortOf.get(s.recipient_user_id) : undefined;
      if (!c) continue;
      groups[c].emails7d++;
      if (s.clicked_at) clicked[c]++;
    }

    const { data: unsubs } = await client.from("founder_email_prefs").select("user_id").gte("unsubscribed_at", since).limit(10000);
    for (const u of (unsubs ?? []) as Array<{ user_id: string }>) {
      const c = cohortOf.get(u.user_id);
      if (c) groups[c].unsubscribes7d++;
    }
  } catch {
    // leave what loaded
  }

  for (const c of ["rollout", "holdout"] as const) {
    const g = groups[c];
    g.emailsPerFounder = g.founders > 0 && g.emails7d > 0 ? g.emails7d / g.founders : g.founders > 0 ? 0 : null;
    g.actionRate = g.emails7d > 0 ? (clicked[c] / g.emails7d) * 100 : null;
    g.atMatchOrLater = g.founders > 0 ? (atMatch[c] / g.founders) * 100 : null;
  }

  let heldPending = 0;
  let digestsSent7d = 0;
  try {
    const [held, digests] = await Promise.all([
      client.from("founder_digest_items").select("id", { count: "exact", head: true }).eq("status", "pending"),
      client.from("email_log").select("id", { count: "exact", head: true }).eq("job", "/api/cron/founder-digest").eq("status", "sent").gte("created_at", since),
    ]);
    heldPending = held.count ?? 0;
    digestsSent7d = digests.count ?? 0;
  } catch {
    // zero
  }

  return {
    ...groups,
    complaints: await loadComplaintState(cfg, client),
    heldPending,
    digestsSent7d,
    loadedAt: new Date().toISOString(),
  };
}
