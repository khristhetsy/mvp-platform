/**
 * Server side of the Private Market weekly emailer: settings, recipients, test
 * sends and the cron runner. Schedules reuse the sequence schedule math (PT), so
 * "Monday 5:00 AM PT" stays 5:00 AM PT across clock changes.
 */
import "server-only";
import { marketingDb } from "@/lib/marketing/db";
import { loadUnsubscribedSet } from "@/lib/marketing/contacts";
import { isValidEmail, firstValidEmail, needsEmailReview } from "@/lib/marketing/recipient";
import { makeUnsubscribeToken } from "@/lib/marketing/send";
import { marketingSendEnabled } from "@/lib/marketing/campaigns";
import { sendEmail } from "@/lib/email/send-email";
import { createNotification, listStaffProfileIds } from "@/lib/notifications/notifications";
import {
  describeSchedule, formatPt, formatTime, latestRun, nextRuns, todayInPt,
  type RepeatRule, type SequenceSchedule,
} from "@/lib/marketing/sequence-schedule";
import { validateScheduleInput, type ScheduleInput } from "@/lib/marketing/sequence-schedule-store";
import { DEFAULT_WEEKLY_THEME, defaultConfig, isWeeklyThemeId, renderWeeklyEmail, testSubject, VERSION_LABEL, versionAudience, type Audience, type EmailLinks, type Version, type WeeklyEmailConfig } from "./weekly-email";
import { hasIntroActivity, nothingChanged, type DigestViewer } from "./weekly-digest";
import { founderViewer, introActivity, investorViewer, loadWeeklyContext, marketOnlyViewer, type WeeklyContext } from "./weekly-data";

/* eslint-disable @typescript-eslint/no-explicit-any */
const COLS = "audience, subject, preheader, note, button_text, sections, groups, list_ids, skip_if_unchanged, from_name, from_email, header_mode, banner_url, banner_strip, sign_off, theme_id, enabled, start_date, end_date, repeat, weekdays, send_time, max_per_run, reminder_minutes, unreviewed_action, reviewed_for, activated_at, last_run_for, run_sent, run_done, last_reminder_for";

export type WeeklySchedule = Omit<SequenceSchedule, "sequence_id"> & { reviewed_for: string | null };
export type WeeklyState = { config: WeeklyEmailConfig; schedule: WeeklySchedule; saved: boolean };

export function defaultSchedule(now: Date = new Date(), version?: Version): WeeklySchedule {
  return {
    enabled: false, start_date: todayInPt(now), end_date: null, repeat: version === "monthly" ? "monthly" : "weekly", weekdays: [1], send_time: "05:00",
    max_per_run: 5000, reminder_minutes: 1440, unreviewed_action: "send",
    activated_at: now.toISOString(), last_run_for: null, run_sent: 0, run_done: false, last_reminder_for: null, reviewed_for: null,
  };
}

const asSchedule = (audience: Version, s: WeeklySchedule): SequenceSchedule => ({ ...s, sequence_id: audience });

function fromRow(r: any): WeeklyState {
  const base = defaultConfig(r.audience);
  return {
    saved: true,
    config: {
      audience: versionAudience(r.audience), version: r.audience, subject: r.subject, preheader: r.preheader ?? "", note: r.note ?? "", buttonText: r.button_text,
      sections: { ...base.sections, ...(r.sections ?? {}) }, groups: r.groups ?? [], listIds: r.list_ids ?? [],
      skipIfUnchanged: !!r.skip_if_unchanged, fromName: r.from_name ?? null, fromEmail: r.from_email ?? null,
      headerMode: r.header_mode === "banner" ? "banner" : "std", bannerUrl: r.banner_url ?? null, bannerStrip: r.banner_strip !== false,
      signOff: r.sign_off?.trim() || null,
      themeId: isWeeklyThemeId(r.theme_id) ? r.theme_id : DEFAULT_WEEKLY_THEME,
    },
    schedule: {
      enabled: !!r.enabled, start_date: r.start_date ?? todayInPt(), end_date: r.end_date ?? null, repeat: r.repeat, weekdays: r.weekdays ?? [],
      send_time: r.send_time, max_per_run: r.max_per_run, reminder_minutes: r.reminder_minutes, unreviewed_action: r.unreviewed_action,
      activated_at: r.activated_at, last_run_for: r.last_run_for, run_sent: r.run_sent, run_done: r.run_done,
      last_reminder_for: r.last_reminder_for, reviewed_for: r.reviewed_for,
    },
  };
}

export async function getWeekly(audience: Version, now: Date = new Date()): Promise<WeeklyState> {
  const { data } = await marketingDb().from("private_market_weekly_emails").select(COLS).eq("audience", audience).maybeSingle();
  return data ? fromRow(data) : { config: defaultConfig(audience), schedule: defaultSchedule(now, audience), saved: false };
}

export type WeeklySaveInput = { config: WeeklyEmailConfig; schedule: Pick<WeeklySchedule, "enabled" | "start_date" | "end_date" | "repeat" | "weekdays" | "send_time" | "max_per_run" | "reminder_minutes" | "unreviewed_action"> };

/** Null when valid, otherwise the sentence to show. */
export function validateWeekly(i: WeeklySaveInput): string | null {
  const c = i.config;
  if (!c.subject.trim()) return "Add a subject line.";
  if (c.subject.length > 200) return "The subject line is too long.";
  if (c.note.length > 600) return "The note is too long (600 characters at most).";
  if (!c.buttonText.trim()) return "Add the button text.";
  if (c.groups.length === 0 && c.listIds.length === 0) return "Pick who to send to.";
  if (c.fromEmail && !isValidEmail(c.fromEmail)) return "The sender address isn't valid.";
  if ((c.signOff ?? "").length > 80) return "The sign off name is too long.";
  if (!isWeeklyThemeId(c.themeId)) return "Pick one of the theme presets.";
  if (c.headerMode === "banner" && !/^https:\/\/[^\s"<>]+$/i.test(c.bannerUrl ?? "")) return "Choose a banner image, or switch back to Logo and title.";
  return validateScheduleInput(i.schedule as ScheduleInput);
}

/** Save the settings. Changing the schedule restarts run state, so a time already passed today is not caught up. */
export async function saveWeekly(i: WeeklySaveInput, userId: string): Promise<void> {
  const err = validateWeekly(i);
  if (err) throw new Error(err);
  const prev = await getWeekly(i.config.version);
  const s = i.schedule;
  const same = prev.saved && prev.schedule.enabled === s.enabled && prev.schedule.start_date === s.start_date && prev.schedule.end_date === (s.end_date || null) &&
    prev.schedule.repeat === s.repeat && prev.schedule.send_time === s.send_time && prev.schedule.weekdays.join() === [...new Set(s.weekdays)].sort().join();
  const now = new Date().toISOString();
  const c = i.config;
  const { error } = await marketingDb().from("private_market_weekly_emails").upsert({
    audience: c.version, subject: c.subject.trim(), preheader: c.preheader.trim(), note: c.note.trim(), button_text: c.buttonText.trim(),
    sections: c.sections, groups: c.groups, list_ids: c.listIds, skip_if_unchanged: c.skipIfUnchanged,
    from_name: c.fromName?.trim() || null, from_email: c.fromEmail?.trim() || null,
    header_mode: c.headerMode === "banner" ? "banner" : "std", banner_url: c.bannerUrl?.trim() || null, banner_strip: c.bannerStrip !== false,
    sign_off: c.signOff?.trim() || null,
    theme_id: c.themeId,
    enabled: s.enabled, start_date: s.start_date, end_date: s.end_date || null, repeat: s.repeat as RepeatRule,
    weekdays: [...new Set(s.weekdays)].filter((d) => d >= 0 && d <= 6).sort(), send_time: s.send_time,
    max_per_run: s.max_per_run, reminder_minutes: Math.max(0, Math.round(s.reminder_minutes)), unreviewed_action: s.unreviewed_action,
    ...(same ? {} : { activated_at: now, last_run_for: null, run_sent: 0, run_done: false, last_reminder_for: null, reviewed_for: null }),
    updated_by: userId, updated_at: now,
  }, { onConflict: "audience" });
  if (error) throw new Error(error.message);
}

/** Marks the next run as reviewed, so "hold if not reviewed" lets it go. */
export async function markNextRunReviewed(audience: Version): Promise<string | null> {
  const st = await getWeekly(audience);
  const next = nextRuns(asSchedule(audience, st.schedule), new Date(), 1)[0];
  if (!next) return null;
  const { error } = await marketingDb().from("private_market_weekly_emails").update({ reviewed_for: next.toISOString() }).eq("audience", audience);
  if (error) throw new Error(error.message);
  return next.toISOString();
}

export function scheduleSummary(audience: Version, s: WeeklySchedule, now: Date = new Date()) {
  const ss = asSchedule(audience, s);
  return { label: describeSchedule(ss), next: nextRuns(ss, now, 4).map((d) => d.toISOString()) };
}

// ---------- Recipients ----------

export type WeeklyRecipient = { email: string; viewer: "founder" | "investor" | "contact"; profileId: string | null };

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

type Person = { id: string; email: string };

export async function platformPeople(role: Audience): Promise<Person[]> {
  const db: any = marketingDb();
  if (role === "founder") {
    const rows = await pageAll<any>((a, b) => db.from("profiles").select("id, email").eq("role", "founder").not("email", "is", null).order("id").range(a, b));
    return rows.map((r) => ({ id: r.id, email: String(r.email) }));
  }
  const approved = await pageAll<any>((a, b) => db.from("investor_profiles").select("profile_id").eq("approval_status", "approved").order("profile_id").range(a, b));
  const ids = approved.map((r) => r.profile_id as string);
  const out: Person[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("profiles").select("id, email").in("id", ids.slice(i, i + 200)).not("email", "is", null);
    out.push(...((data ?? []) as any[]).map((r) => ({ id: r.id, email: String(r.email) })));
  }
  return out;
}

async function listContacts(listIds: string[]): Promise<Array<{ email: string; tags: string[] | null }>> {
  const db: any = marketingDb();
  const out: Array<{ email: string; tags: string[] | null }> = [];
  for (const listId of listIds) {
    const ids = (await pageAll<any>((a, b) => db.from("marketing_list_contacts").select("contact_id").eq("list_id", listId).order("contact_id").range(a, b))).map((r) => r.contact_id as string);
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from("marketing_contacts").select("email, tags").in("id", ids.slice(i, i + 200));
      out.push(...((data ?? []) as any[]).map((r) => ({ email: String(r.email), tags: r.tags ?? null })));
    }
  }
  return out;
}

/**
 * Everyone the version goes to: the chosen platform groups and contact lists,
 * deduplicated by address, minus the suppression list and contacts held for
 * email review. A person with a platform account of this version's role gets
 * their personal rating or matches; everyone else gets the market sections.
 */
export async function resolveRecipients(config: WeeklyEmailConfig): Promise<{ recipients: WeeklyRecipient[]; suppressed: number; duplicates: number }> {
  const [unsub, own] = await Promise.all([loadUnsubscribedSet(), platformPeople(config.audience)]);
  const ownByEmail = new Map(own.map((p) => [p.email.trim().toLowerCase(), p.id]));
  const seen = new Map<string, WeeklyRecipient>();
  let suppressed = 0, duplicates = 0;
  const add = (raw: string, viewer: WeeklyRecipient["viewer"], profileId: string | null) => {
    const email = firstValidEmail(raw);
    if (!email) return;
    if (unsub.has(email)) { suppressed++; return; }
    const prev = seen.get(email);
    if (prev) { duplicates++; return; }
    seen.set(email, { email, viewer, profileId });
  };
  if (config.groups.includes(config.audience)) for (const p of own) add(p.email, config.audience, p.id);
  if (config.listIds.length > 0) {
    for (const c of await listContacts(config.listIds)) {
      if (needsEmailReview(c.tags)) continue;
      const email = firstValidEmail(c.email);
      const pid = email ? ownByEmail.get(email) ?? null : null;
      add(c.email, pid ? config.audience : "contact", pid);
    }
  }
  return { recipients: [...seen.values()], suppressed, duplicates };
}

// ---------- Rendering one recipient ----------

function linksFor(email: string): EmailLinks {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/+$/, "");
  return {
    appUrl,
    logoUrl: process.env.EMAIL_LOGO_URL ?? `${appUrl}/email-logo.png`,
    unsubscribeUrl: `${appUrl}/unsubscribe?token=${makeUnsubscribeToken(email)}`,
    preferencesUrl: `${appUrl}/preferences`,
  };
}

async function viewerFor(ctx: WeeklyContext, version: Version, r: WeeklyRecipient): Promise<DigestViewer> {
  const audience = versionAudience(version);
  if (r.viewer === "contact" || !r.profileId) return marketOnlyViewer(audience);
  if (audience === "founder") return founderViewer(ctx, r.profileId);
  const v = await investorViewer(ctx, r.profileId);
  return version === "intros" && v.kind === "investor" && !v.marketOnly ? { kind: "investor", matches: v.matches, hasProfile: v.hasProfile, intros: await introActivity(ctx, r.profileId) } : v;
}

/** The introduction email only goes to an investor with activity this week. */
const skipRecipient = (version: Version, viewer: DigestViewer): boolean =>
  version === "intros" && !(viewer.kind === "investor" && !viewer.marketOnly && hasIntroActivity(viewer.intros));

async function deliver(config: WeeklyEmailConfig, ctx: WeeklyContext, email: string, viewer: DigestViewer, test: boolean, triggeredBy: string | null) {
  const links = linksFor(email);
  const out = renderWeeklyEmail({ config, market: ctx.market, viewer, links, test });
  const ok = await sendEmail({
    to: email, subject: out.subject, html: out.html, text: out.text,
    fromName: config.fromName ?? undefined, fromAddress: config.fromEmail,
    headers: { "List-Unsubscribe": `<${links.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: [{ name: "kind", value: test ? "private-market-weekly-test" : "private-market-weekly" }, { name: "version", value: config.version }],
    source: test ? "private-market-weekly-test" : "private-market-weekly",
    audience: (test ? "staff" : config.audience) as "staff" | "founder" | "investor",
    triggeredBy,
  });
  return ok;
}

// ---------- Test send ----------

export const TEST_MAX_ADDRESSES = 10;

/** Sends only to the addresses entered. Never to a list, never logged as a weekly send. */
export async function sendTestEmail(config: WeeklyEmailConfig, to: string[], example: DigestViewer, userId: string): Promise<{ sent: number; failed: string[]; subject: string }> {
  const addresses = [...new Set(to.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (addresses.length === 0) throw new Error("Add at least one address.");
  if (addresses.length > TEST_MAX_ADDRESSES) throw new Error(`Send a test to ${TEST_MAX_ADDRESSES} addresses at most.`);
  const bad = addresses.filter((a) => !isValidEmail(a));
  if (bad.length) throw new Error(`Not a valid address: ${bad.join(", ")}`);
  const ctx = await loadWeeklyContext();
  if (!ctx) throw new Error("The market numbers could not be read, so no test was sent.");
  let sent = 0;
  const failed: string[] = [];
  for (const a of addresses) {
    if (await deliver(config, ctx, a, example, true, userId)) sent++; else failed.push(a);
  }
  return { sent, failed, subject: testSubject(renderWeeklyEmail({ config, market: ctx.market, viewer: example, links: linksFor(addresses[0]) }).subject) };
}

// ---------- Cron runner ----------

export type WeeklyRunResult = { runs: number; sent: number; failed: number; held: number; skippedUnchanged: number; reminders: number };

export async function runWeeklyEmails(now: Date = new Date(), budgetMs = 240_000): Promise<WeeklyRunResult> {
  const started = Date.now();
  const timeLeft = () => budgetMs - (Date.now() - started);
  const db: any = marketingDb();
  const out: WeeklyRunResult = { runs: 0, sent: 0, failed: 0, held: 0, skippedUnchanged: 0, reminders: 0 };
  const { data } = await db.from("private_market_weekly_emails").select(`${COLS}, updated_by`).eq("enabled", true);
  const states = ((data ?? []) as any[]).map((r) => ({ ...fromRow(r), updatedBy: (r.updated_by as string | null) ?? null }));

  for (const st of states) {
    const audience = st.config.version;
    const sched = asSchedule(audience, st.schedule);
    const run = latestRun(sched, now);
    if (!run || run < new Date(st.schedule.activated_at)) continue;
    const isCurrent = st.schedule.last_run_for && new Date(st.schedule.last_run_for).getTime() === run.getTime();
    if (isCurrent && st.schedule.run_done) continue;
    if (!marketingSendEnabled()) continue;

    if (!isCurrent) await db.from("private_market_weekly_emails").update({ last_run_for: run.toISOString(), run_sent: 0, run_done: false }).eq("audience", audience);

    const reviewed = st.schedule.reviewed_for && new Date(st.schedule.reviewed_for).getTime() === run.getTime();
    if (st.schedule.unreviewed_action === "hold" && !reviewed) { out.held++; continue; }
    if (timeLeft() < 20_000) break;

    const ctx = await loadWeeklyContext(now);
    if (!ctx) continue; // numbers unreadable: try again on the next 5 minute pass
    const nothingToSend =
      (audience === "listed" && (ctx.market.newCompanies?.length ?? 0) === 0) ||
      (audience === "monthly" && !ctx.market.monthly) ||
      ((audience === "founder" || audience === "investor") && st.config.skipIfUnchanged && nothingChanged(ctx.market));
    if (nothingToSend) {
      await db.from("private_market_weekly_emails").update({ run_done: true }).eq("audience", audience);
      out.skippedUnchanged++;
      continue;
    }

    const { recipients } = await resolveRecipients(st.config);
    const already = new Set<string>();
    for (const r of await pageAll<any>((a, b) => db.from("private_market_weekly_sends").select("email").eq("audience", audience).eq("run_for", run.toISOString()).order("email").range(a, b))) already.add(r.email);

    let sent = isCurrent ? st.schedule.run_sent : 0;
    let outOfTime = false;
    for (const r of recipients) {
      if (already.has(r.email)) continue;
      if (sent >= st.schedule.max_per_run) break;
      if (timeLeft() < 20_000) { outOfTime = true; break; }
      let ok = false, error: string | null = null;
      try {
        const viewer = await viewerFor(ctx, audience, r);
        if (skipRecipient(audience, viewer)) {
          await db.from("private_market_weekly_sends").upsert({ audience, run_for: run.toISOString(), email: r.email, status: "skipped", error: "No introduction activity" }, { onConflict: "audience,run_for,email" });
          continue;
        }
        ok = await deliver(st.config, ctx, r.email, viewer, false, st.updatedBy);
        if (!ok) error = "Send failed";
      }
      catch (e) { error = e instanceof Error ? e.message.slice(0, 200) : "Send failed"; }
      await db.from("private_market_weekly_sends").upsert({ audience, run_for: run.toISOString(), email: r.email, status: ok ? "sent" : "failed", error }, { onConflict: "audience,run_for,email" });
      sent++;
      if (ok) out.sent++; else out.failed++;
      await new Promise((res) => setTimeout(res, 150));
    }
    await db.from("private_market_weekly_emails").update({ run_sent: sent, run_done: !outOfTime }).eq("audience", audience);
    out.runs++;
  }

  // Review reminder before the next run.
  for (const st of states) {
    if (st.schedule.reminder_minutes <= 0) continue;
    const audience = st.config.version;
    const next = nextRuns(asSchedule(audience, st.schedule), now, 1)[0];
    if (!next || next.getTime() - st.schedule.reminder_minutes * 60_000 > now.getTime()) continue;
    if (st.schedule.last_reminder_for && new Date(st.schedule.last_reminder_for).getTime() === next.getTime()) continue;
    await db.from("private_market_weekly_emails").update({ last_reminder_for: next.toISOString() }).eq("audience", audience);
    if (st.schedule.reviewed_for && new Date(st.schedule.reviewed_for).getTime() === next.getTime()) continue;
    const recipients = st.updatedBy ? [st.updatedBy] : await listStaffProfileIds();
    const label = VERSION_LABEL[audience].toLowerCase();
    await Promise.all(recipients.map((recipientUserId) => createNotification({
      recipientUserId, type: "private_market_weekly_reminder",
      title: `Review the ${label} email before ${formatTime(st.schedule.send_time)} PT`,
      message: `The ${label} Private Market email sends ${formatPt(next)}. ` + (st.schedule.unreviewed_action === "send" ? "It goes out even if not reviewed." : "It is held until you mark it reviewed."),
      entityType: "private_market_weekly_email", entityId: audience, severity: "info",
      deepLink: "/admin/private-market/weekly-emailer", dedupeKey: `pm-weekly-reminder:${audience}:${next.toISOString()}`,
    })));
    out.reminders++;
  }
  return out;
}
