/**
 * The email gate. Called by sendEmail before every send; returns null (send as
 * normal) in every case except one: a scheduled founder facing job is emailing
 * a single founder who is in the rollout cohort. Then the email is either held
 * for the founder's next digest or dropped because the founder asked for
 * instant alerts only.
 *
 * Never throws and never loses an email: if anything fails (no table, no
 * config, a lookup error), the answer is null and the email goes out as before.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { currentJob } from "@/lib/cron/job-context";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { jobTier, loadBudgetConfig } from "./config";
import { loadFounderPrefs } from "./prefs";
import { cohortFor, excerptOf, primaryLinkOf } from "./rules";

export type HoldDecision = { action: "hold" | "drop"; reason: string } | null;

type GatePayload = {
  to: string | string[];
  cc?: string | string[] | null;
  bcc?: string | string[] | null;
  subject: string;
  html: string;
  text?: string;
};

function addresses(value?: string | string[] | null): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(/[,;]/);
  return list.map((s) => s.trim()).filter((s) => s.includes("@"));
}

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function holdForFounderDigest(payload: GatePayload): Promise<HoldDecision> {
  try {
    const job = currentJob()?.job ?? null;
    const tier = jobTier(job);
    if (!tier || !job) return null;

    const to = addresses(payload.to);
    if (to.length !== 1 || addresses(payload.cc).length || addresses(payload.bcc).length) return null;

    const cfg = await loadBudgetConfig();
    if (cfg.rolloutPct <= 0) return null;

    const client = db();
    const email = to[0];
    const { data: found } = await client
      .from("profiles")
      .select("id, email, role")
      .in("email", [...new Set([email, email.toLowerCase()])])
      .limit(1);
    const p = ((found ?? [])[0] ?? null) as { id: string; email: string | null; role: string | null } | null;
    if (!p || p.role !== "founder" || isInternalAccount(p)) return null;
    if (cohortFor(p.id, cfg) !== "rollout") return null;

    const prefs = await loadFounderPrefs(p.id);

    if (tier === "weekly") {
      return prefs.mode === "instant" ? { action: "drop", reason: "Founder chose instant alerts only" } : null;
    }

    if (!cfg.rules.batchIntoDigest) return null;
    if (prefs.mode === "instant") return { action: "drop", reason: "Founder chose instant alerts only" };

    const subject = payload.subject.slice(0, 300);

    if (cfg.rules.repeatLimit) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await client
        .from("founder_digest_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", p.id)
        .eq("subject", subject)
        .gte("created_at", since);
      if ((count ?? 0) >= cfg.maxRemindersPerItem) {
        return { action: "drop", reason: `Same reminder already sent ${count} times in 30 days` };
      }
    }

    const { error } = await client.from("founder_digest_items").insert({
      user_id: p.id,
      source_job: job,
      subject,
      excerpt: excerptOf(payload.html, payload.text) || null,
      url: primaryLinkOf(payload.html),
    });
    if (error) return null;
    return { action: "hold", reason: "Held for the founder's digest" };
  } catch {
    return null;
  }
}
