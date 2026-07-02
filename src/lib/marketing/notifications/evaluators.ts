// Reminder evaluators. A cron calls runReminders() every 15–30 min; each evaluator
// reads existing hub data and emits via the shared service, deduped per window.
//
// Several evaluators depend on tables owned by OTHER specs (the compliance queue,
// analytics.segment_health). Until those land, the reads fail softly and the
// reminder simply no-ops — it never throws. This matches spec §13.

import { marketingDb } from "@/lib/marketing/db";
import { emitNotification } from "./emit";
import { loadPrefs, loadSettings } from "./store";
import { resolve } from "./resolve";
import { getNotifType } from "./catalog";
import { isDailyDue, isWeeklyDue, cadenceThresholdMs, windowKey } from "./cadence";
import type { NotifSettings, NotifPref } from "./types";

export interface ReminderRunResult {
  admins: number;
  emitted: number;
  evaluated: number;
}

type Ctx = { adminId: string; settings: NotifSettings; prefs: Map<string, NotifPref>; now: Date };

function effectiveFor(ctx: Ctx, typeId: string) {
  return resolve(typeId, ctx.prefs.get(typeId), ctx.settings.master_on);
}

/** Oldest unreviewed compliance asset age in ms, or null if unavailable. */
async function oldestUnreviewedAgeMs(): Promise<number | null> {
  try {
    const db = marketingDb();
    // Table owned by the compliance-gate spec; may not exist yet.
    const { data, error } = await db
      .from("mkt_compliance_queue")
      .select("created_at")
      .is("reviewed_at", null)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const oldest = new Date(data[0].created_at as string).getTime();
    return Date.now() - oldest;
  } catch {
    return null;
  }
}

/** Idle days for a named segment cohort, or null if the health table is unavailable. */
async function segmentIdleDays(kind: "warm" | "investor"): Promise<number | null> {
  try {
    const db = marketingDb();
    // Table owned by the segments/analytics spec; may not exist yet.
    const { data, error } = await db
      .from("segment_health")
      .select("days_idle,cohort")
      .eq("cohort", kind)
      .maybeSingle();
    if (error || !data) return null;
    const d = Number((data as { days_idle?: number }).days_idle);
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

async function evalAdmin(ctx: Ctx): Promise<{ emitted: number; evaluated: number }> {
  let emitted = 0;
  let evaluated = 0;
  const tz = ctx.settings.timezone;

  const fire = async (typeId: string, title: string, body: string, link: string, dedupe: string) => {
    const r = await emitNotification({ adminId: ctx.adminId, typeId, title, body, link, dedupeKey: dedupe });
    if ("delivered" in r && (r.inApp || r.email || r.push)) emitted += 1;
  };

  // cmo.brief_ready — fires at the admin's digest time (once/day).
  {
    const eff = effectiveFor(ctx, "cmo.brief_ready");
    if (eff?.enabled) {
      evaluated += 1;
      const cadence = eff.cadence ?? `daily_${ctx.settings.digest_time.replace(":", "")}`;
      if (isDailyDue(cadence, tz, ctx.now)) {
        const t = getNotifType("cmo.brief_ready");
        await fire("cmo.brief_ready", t?.preview?.title ?? "Your morning brief is ready",
          t?.preview?.body ?? "Your AI CMO has a fresh strategic brief for today.",
          "/admin/marketing", `cmo.brief_ready:${windowKey(cadence, ctx.now)}`);
      }
    }
  }

  // aiseo.weekly_report — fires on its cadence weekday (once/week).
  {
    const eff = effectiveFor(ctx, "aiseo.weekly_report");
    if (eff?.enabled) {
      evaluated += 1;
      if (isWeeklyDue(eff.cadence ?? "weekly_mon", tz, ctx.now)) {
        const t = getNotifType("aiseo.weekly_report");
        await fire("aiseo.weekly_report", t?.preview?.title ?? "Weekly visibility report",
          t?.preview?.body ?? "Your share-of-model summary is ready.",
          "/admin/marketing/analytics", `aiseo.weekly_report:${windowKey(eff.cadence ?? "weekly_mon", ctx.now)}`);
      }
    }
  }

  // compliance.queue_stale — oldest unreviewed asset older than the cadence threshold.
  {
    const eff = effectiveFor(ctx, "compliance.queue_stale");
    if (eff?.enabled) {
      evaluated += 1;
      const threshold = cadenceThresholdMs(eff.cadence ?? "after_4h");
      const age = await oldestUnreviewedAgeMs();
      if (age != null && threshold > 0 && age > threshold) {
        await fire("compliance.queue_stale", "Compliance queue not cleared",
          "Assets have been waiting past your reminder threshold.",
          "/admin/marketing", `compliance.queue_stale:${windowKey(eff.cadence ?? "after_4h", ctx.now)}`);
      }
    }
  }

  // segments.warm_idle / segments.investor_untouched — cohort idle past cadence days.
  for (const [typeId, cohort, link] of [
    ["segments.warm_idle", "warm", "/admin/marketing/lists"],
    ["segments.investor_untouched", "investor", "/admin/marketing/lists"],
  ] as const) {
    const eff = effectiveFor(ctx, typeId);
    if (!eff?.enabled) continue;
    evaluated += 1;
    const thresholdDays = Math.round(cadenceThresholdMs(eff.cadence ?? "after_5d") / 86_400_000);
    const idle = await segmentIdleDays(cohort);
    if (idle != null && thresholdDays > 0 && idle >= thresholdDays) {
      const t = getNotifType(typeId);
      await fire(typeId, t?.label ?? "Segment reminder",
        `This cohort has been idle for ${idle} days.`, link,
        `${typeId}:${windowKey(eff.cadence ?? "after_5d", ctx.now)}`);
    }
  }

  return { emitted, evaluated };
}

export async function runReminders(adminIds: string[], now: Date = new Date()): Promise<ReminderRunResult> {
  let emitted = 0;
  let evaluated = 0;
  for (const adminId of adminIds) {
    const [settings, prefs] = await Promise.all([loadSettings(adminId), loadPrefs(adminId)]);
    const res = await evalAdmin({ adminId, settings, prefs, now });
    emitted += res.emitted;
    evaluated += res.evaluated;
  }
  return { admins: adminIds.length, emitted, evaluated };
}
