/**
 * The founder digest job (hourly). For every founder with held items it
 * decides, in the founder's own time zone, whether their digest is due this
 * hour, then sends one email with their next step and everything held since
 * the last one. Items that wait longer than the admin limit expire instead.
 *
 * Every rule is best effort and logged in the run result, so Admin, Scheduled
 * jobs shows what happened on each run.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { renderEmail, type EmailBlock } from "@/lib/email/layout";
import { getAppUrl } from "@/lib/env";
import { makeToken } from "@/lib/signed-links/tokens";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { DIGEST_JOB_PATH, loadBudgetConfig, type BudgetConfig, type FounderEmailMode } from "./config";
import { DEFAULT_FOUNDER_TZ, loadFounderPrefsMany, type FounderEmailPrefs } from "./prefs";
import {
  STEP_NAMES,
  complaintState,
  digestDue,
  downshiftTarget,
  localParts,
  nextStepAction,
  stepForStage,
  type ComplaintState,
} from "./rules";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export function appBase(): string {
  return (getAppUrl() ?? "https://icapos.com").replace(/\/+$/, "");
}

export function unsubscribeUrl(userId: string): string {
  const t = makeToken({ kind: "email_prefs", id: userId, action: "instant_only", expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 });
  return `${appBase()}/api/email/unsubscribe?t=${encodeURIComponent(t)}`;
}

/** Founder email complaint rate over the last 30 days, from the email log. */
export async function loadComplaintState(cfg: BudgetConfig, client: SupabaseClient = db()): Promise<ComplaintState> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [sent, complained] = await Promise.all([
      client.from("email_log").select("id", { count: "exact", head: true }).eq("recipient_role", "founder").eq("status", "sent").gte("created_at", since),
      client.from("email_log").select("id", { count: "exact", head: true }).eq("recipient_role", "founder").not("complained_at", "is", null).gte("created_at", since),
    ]);
    return complaintState(sent.count ?? 0, complained.count ?? 0, cfg);
  } catch {
    return complaintState(0, 0, cfg);
  }
}

type Item = { id: number; user_id: string; subject: string; excerpt: string | null; url: string | null; created_at: string };
type Founder = { id: string; email: string | null; full_name: string | null; role: string | null; last_seen_at: string | null; journey_stage: string | null };
type DigestLog = { recipient_user_id: string; created_at: string; opened_at: string | null; clicked_at: string | null; status: string };

export type DigestRunResult = {
  ok: boolean;
  paused?: string;
  founders: number;
  sent: number;
  notDue: number;
  skippedActive: number;
  downshifted: number;
  dropped: number;
  expired: number;
  failed: number;
};

const MAX_ROWS_IN_EMAIL = 10;

export function buildDigestEmail(input: {
  firstName: string | null;
  mode: Exclude<FounderEmailMode, "instant">;
  step: number;
  items: Array<Pick<Item, "subject" | "excerpt" | "url">>;
  dateLabel: string;
  preferencesUrl: string;
  instantOnlyUrl: string;
  downshiftedFrom: FounderEmailMode | null;
}) {
  const base = appBase();
  const action = nextStepAction(input.step);
  const n = input.items.length;
  const weekly = input.mode === "weekly";
  const subject = weekly
    ? `Your week on iCapOS: ${n} ${n === 1 ? "update" : "updates"}`
    : `Your raise today: 1 thing to do, ${n} ${n === 1 ? "update" : "updates"}`;
  const blocks: EmailBlock[] = [
    { type: "journey", step: input.step },
    { type: "action", title: action.title, subtitle: action.subtitle, button: { label: action.label, url: `${base}${action.path}` } },
    {
      type: "rows",
      title: weekly ? "This week" : "Since your last update",
      items: input.items.slice(0, MAX_ROWS_IN_EMAIL).map((i) => ({ title: i.subject, subtitle: i.excerpt, url: i.url })),
    },
  ];
  if (n > MAX_ROWS_IN_EMAIL) {
    blocks.push({ type: "note", text: `${n - MAX_ROWS_IN_EMAIL} more in your iCapOS inbox.` });
  }
  if (input.downshiftedFrom) {
    blocks.push({
      type: "note",
      text: weekly
        ? "You had not opened your daily updates for a while, so we moved you to one email a week. You can switch back any time in email settings."
        : "We moved you to fewer emails because recent ones went unopened. You can change this any time in email settings.",
    });
  }
  blocks.push({
    type: "html",
    html: `<p style="margin:0;font-size:12px;line-height:19px;color:#5A6B8C;">Investor replies, accepted intros and booked meetings still reach you right away. <a href="${input.instantOnlyUrl}" style="color:#5A6B8C;text-decoration:underline;">Only send me instant alerts</a></p>`,
  });
  const hello = input.firstName ? `Hi ${input.firstName}.` : "Hi.";
  return renderEmail({
    audience: "founder",
    subject,
    preheader: `${action.title}. ${n} ${n === 1 ? "update" : "updates"} since your last email.`,
    context: input.dateLabel,
    eyebrow: weekly ? "Weekly summary" : "Daily update",
    headline: `${hello} You are on step ${input.step + 1} of 4: ${STEP_NAMES[input.step]}.`,
    blocks,
    footer: {
      reason: weekly
        ? "You get this once a week, only when there is something new."
        : "You get this once a day, only when there is something new.",
      preferencesUrl: input.preferencesUrl,
      preferencesLabel: "Change how often you get this",
    },
  });
}

export async function runFounderDigestPass(now: Date = new Date()): Promise<DigestRunResult> {
  const result: DigestRunResult = { ok: true, founders: 0, sent: 0, notDue: 0, skippedActive: 0, downshifted: 0, dropped: 0, expired: 0, failed: 0 };
  const cfg = await loadBudgetConfig({ fresh: true });
  const client = db();
  const nowIso = now.toISOString();

  // 1. Expire items that waited too long.
  const cutoff = new Date(now.getTime() - cfg.itemMaxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: expired } = await client
    .from("founder_digest_items")
    .update({ status: "expired", resolved_at: nowIso, reason: `Older than ${cfg.itemMaxAgeDays} days` })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  result.expired = (expired ?? []).length;

  // 2. Complaint guard.
  const complaints = await loadComplaintState(cfg, client);
  if (complaints.level === "pause") {
    result.paused = `Founder complaint rate ${complaints.rate.toFixed(2)}% over 30 days is at or above ${cfg.complaintPausePct}%`;
    return result;
  }

  // 3. Who has something waiting.
  const { data: itemRows } = await client
    .from("founder_digest_items")
    .select("id, user_id, subject, excerpt, url, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5000);
  const items = (itemRows ?? []) as Item[];
  if (!items.length) return result;
  const byFounder = new Map<string, Item[]>();
  for (const i of items) byFounder.set(i.user_id, [...(byFounder.get(i.user_id) ?? []), i]);
  const ids = [...byFounder.keys()];
  result.founders = ids.length;

  const founders = new Map<string, Founder>();
  const notifTz = new Map<string, string>();
  const logs = new Map<string, DigestLog[]>();
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const [{ data: fs }, { data: np }, { data: dl }] = await Promise.all([
      client.from("profiles").select("id, email, full_name, role, last_seen_at, journey_stage").in("id", chunk),
      client.from("notification_preferences").select("user_id, timezone").in("user_id", chunk),
      client
        .from("email_log")
        .select("recipient_user_id, created_at, opened_at, clicked_at, status")
        .eq("job", DIGEST_JOB_PATH)
        .eq("status", "sent")
        .in("recipient_user_id", chunk)
        .gte("created_at", new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);
    for (const f of (fs ?? []) as Founder[]) founders.set(f.id, f);
    for (const n of (np ?? []) as Array<{ user_id: string; timezone: string | null }>) if (n.timezone) notifTz.set(n.user_id, n.timezone);
    for (const l of (dl ?? []) as DigestLog[]) logs.set(l.recipient_user_id, [...(logs.get(l.recipient_user_id) ?? []), l]);
  }
  const prefsMap = await loadFounderPrefsMany(ids);

  const resolve = async (itemIds: number[], status: "sent" | "dropped", reason: string | null) => {
    for (let i = 0; i < itemIds.length; i += 500) {
      await client.from("founder_digest_items").update({ status, resolved_at: nowIso, reason }).in("id", itemIds.slice(i, i + 500));
    }
  };

  for (const id of ids) {
    const founderItems = byFounder.get(id) ?? [];
    const f = founders.get(id);
    try {
      if (!f || !f.email || isInternalAccount(f)) {
        await resolve(founderItems.map((i) => i.id), "dropped", "Not a founder account");
        result.dropped += founderItems.length;
        continue;
      }
      const prefs: FounderEmailPrefs = prefsMap.get(id) ?? { mode: "daily", sendHour: null, timezone: null, skipIfActive: true, downshiftedAt: null, downshiftFrom: null };
      let mode = prefs.mode;
      let downshiftedFrom: FounderEmailMode | null = null;

      if (mode === "instant") {
        await resolve(founderItems.map((i) => i.id), "dropped", "Founder chose instant alerts only");
        result.dropped += founderItems.length;
        continue;
      }

      const tz = cfg.rules.localTime ? prefs.timezone ?? notifTz.get(id) ?? DEFAULT_FOUNDER_TZ : "UTC";
      const local = localParts(now, tz);
      const history = logs.get(id) ?? [];
      const sentToday = history.filter((l) => localParts(new Date(l.created_at), tz).dateKey === local.dateKey).length;
      const sendHour = prefs.sendHour ?? cfg.sendHour;

      if (!digestDue({ mode, sendHour, local, sentToday, cfg })) {
        result.notDue++;
        continue;
      }

      // Already in the app since the newest item arrived: they have seen it.
      const newest = founderItems[founderItems.length - 1];
      if (
        cfg.rules.skipIfActive && prefs.skipIfActive && cfg.skipActiveHours > 0 && f.last_seen_at &&
        now.getTime() - new Date(f.last_seen_at).getTime() < cfg.skipActiveHours * 60 * 60 * 1000 &&
        new Date(f.last_seen_at).getTime() > new Date(newest.created_at).getTime()
      ) {
        result.skippedActive++;
        continue;
      }

      if (cfg.rules.autoDownshift) {
        const target = downshiftTarget(
          mode,
          history.map((l) => ({ openedAt: l.opened_at, clickedAt: l.clicked_at, sentAt: l.created_at })),
          cfg.downshiftAfter,
          now,
        );
        if (target) {
          await client.from("founder_email_prefs").upsert(
            { user_id: id, mode: target, downshifted_at: nowIso, downshift_from: mode, updated_at: nowIso },
            { onConflict: "user_id" },
          );
          result.downshifted++;
          downshiftedFrom = mode;
          mode = target;
          if (mode === "instant") {
            await resolve(founderItems.map((i) => i.id), "dropped", "Moved to instant alerts only after unopened summaries");
            result.dropped += founderItems.length;
            continue;
          }
          if (!digestDue({ mode, sendHour, local, sentToday, cfg })) {
            result.notDue++;
            continue;
          }
        }
      }

      if (cfg.rules.suppressEmpty && founderItems.length === 0) continue;

      const base = appBase();
      const instantOnly = unsubscribeUrl(id);
      const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(now);
      const firstName = (f.full_name ?? "").trim().split(/\s+/)[0] || null;
      const email = buildDigestEmail({
        firstName,
        mode: mode === "weekly" ? "weekly" : "daily",
        step: stepForStage(f.journey_stage),
        items: founderItems,
        dateLabel,
        preferencesUrl: `${base}/founder/settings/email`,
        instantOnlyUrl: instantOnly,
        downshiftedFrom,
      });
      const headers = cfg.rules.oneClickUnsubscribe
        ? { "List-Unsubscribe": `<${instantOnly}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined;
      const ok = await sendEmail({
        to: f.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers,
        audience: "founder",
        tags: [{ name: "kind", value: "founder_digest" }],
      });
      if (ok) {
        await resolve(founderItems.map((i) => i.id), "sent", null);
        result.sent++;
      } else {
        result.failed++;
      }
    } catch {
      result.failed++;
    }
  }
  return result;
}
