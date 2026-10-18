// AI IR Coach reminders: the sending half. Run by the daily founder-nudges cron as its own
// best effort pass, so it inherits that job's pause switch, run log and founder email budget
// (the job is on the digest tier, so a rollout founder's coach email is held for the digest).
//
// Rules, in order, for every founder:
//   1. Only active enrollments, and only while an admin has the coach switched on for a course.
//   2. Internal and staff accounts are skipped, never emailed (repo rule).
//   3. Notification settings win: pause all, in app off, email off. Email also waits out quiet hours.
//   4. Every message that is sent or held back is written to coach_messages, which also prevents repeats.
// Nothing here writes to Tasks or Calendar. Best effort: never throws into the cron.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import { NOT_A_BROKER_DEALER, renderEmail } from "@/lib/email/layout";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { isQuietNow, loadNotificationPrefs } from "@/lib/notifications/preferences";
import { coerceCoachTone, type CoachTone } from "@/lib/learning/coach/tones";
import {
  coachMessageCopy,
  planCoachMessages,
  type OpenCommitment,
  type PlannedMessage,
  type SentMessage,
} from "@/lib/learning/coach/reminders";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");
const LEARNING_PATH = "/founder/learning";
const LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;

export function coachReminderEmail(input: { firstName: string; title: string; message: string }) {
  return renderEmail({
    audience: "founder",
    subject: input.title,
    preheader: input.message.slice(0, 110),
    eyebrow: "Your AI IR Coach",
    headline: input.title,
    intro: `Hi ${input.firstName}, ${input.message}`,
    primary: { label: "Open my next step", url: `${SITE_URL}${LEARNING_PATH}` },
    footer: {
      reason:
        "You're receiving this because you are enrolled in AI IR Coach coaching. You can pause the coach inside any coached lesson, or change your alerts in notification settings.",
      preferencesUrl: `${SITE_URL}/founder/settings`,
      lines: [NOT_A_BROKER_DEALER],
    },
  });
}

export type CoachReminderResult = { sent: number; suppressed: number; failed: number; missed: number; kept: number; skippedInternal: number };

export async function runCoachReminderPass(limit = 300, now: Date = new Date()): Promise<CoachReminderResult> {
  const out: CoachReminderResult = { sent: 0, suppressed: 0, failed: 0, missed: 0, kept: 0, skippedInternal: 0 };
  try {
    const db = createServiceRoleClient() as unknown as SupabaseClient;

    // The coach is off until an admin enables at least one course.
    const { data: cfg } = await db.from("course_coach_config").select("course_key").eq("enabled", true);
    const enabledCourses = ((cfg ?? []) as Array<{ course_key: string }>).map((r) => r.course_key);
    if (enabledCourses.length === 0) return out;

    const { data: enr } = await db
      .from("coach_enrollments")
      .select("founder_id, company_id, tone, started_at")
      .eq("status", "active")
      .limit(limit);
    const enrollments = (enr ?? []) as Array<{ founder_id: string; company_id: string; tone: string; started_at: string }>;
    if (enrollments.length === 0) return out;

    const ids = [...new Set(enrollments.map((e) => e.founder_id))];
    const { data: profs } = await db.from("profiles").select("id, email, full_name, role").in("id", ids);
    const profile = new Map(((profs ?? []) as Array<{ id: string; email: string | null; full_name: string | null; role: string | null }>).map((p) => [p.id, p]));

    const since = new Date(now.getTime() - LOOKBACK_MS).toISOString();
    const [events, commitments, messages] = await Promise.all([
      db.from("coach_step_events").select("founder_id, company_id, course_slug, lesson_id, step_index, event, created_at").in("founder_id", ids).gte("created_at", since),
      db.from("coach_commitments").select("id, founder_id, company_id, course_slug, lesson_id, step_index, title, due_at, status, created_at").in("founder_id", ids).eq("status", "open"),
      db.from("coach_messages").select("founder_id, company_id, kind, channel, metadata, created_at").in("founder_id", ids).in("kind", ["commitment_check", "quiet_founder"]).gte("created_at", since),
    ]);
    const eventRows = (events.data ?? []) as Row[];
    const commitmentRows = (commitments.data ?? []) as Row[];
    const messageRows = (messages.data ?? []) as Row[];
    const mine = (r: Row, e: { founder_id: string; company_id: string }) => r.founder_id === e.founder_id && r.company_id === e.company_id;

    for (const e of enrollments) {
      const p = profile.get(e.founder_id);
      if (!p || p.role !== "founder" || isInternalAccount(p)) {
        out.skippedInternal += 1;
        continue;
      }
      const tone: CoachTone = coerceCoachTone(e.tone);
      const evs = eventRows.filter((r) => mine(r, e));
      const open = commitmentRows.filter((r) => mine(r, e));

      // Kept: the founder marked the step done after making the commitment.
      const live: OpenCommitment[] = [];
      for (const c of open) {
        const createdAt = new Date(String(c.created_at)).getTime();
        const done = evs.some(
          (v) =>
            v.event === "done" &&
            v.course_slug === c.course_slug &&
            v.lesson_id === c.lesson_id &&
            v.step_index === c.step_index &&
            new Date(String(v.created_at)).getTime() > createdAt,
        );
        if (done) {
          await db.from("coach_commitments").update({ status: "kept", resolved_at: now.toISOString() }).eq("id", c.id);
          out.kept += 1;
        } else {
          live.push({ id: String(c.id), title: String(c.title), courseSlug: String(c.course_slug), dueAt: new Date(String(c.due_at)) });
        }
      }

      const stamps = [
        new Date(e.started_at).getTime(),
        ...evs.map((v) => new Date(String(v.created_at)).getTime()),
        ...open.map((c) => new Date(String(c.created_at)).getTime()),
      ].filter(Number.isFinite);
      const lastActivityAt = new Date(Math.max(...stamps));

      const sent: SentMessage[] = messageRows
        .filter((m) => mine(m, e))
        .map((m) => ({
          kind: String(m.kind),
          channel: String(m.channel),
          createdAt: new Date(String(m.created_at)),
          metadata: (m.metadata ?? null) as SentMessage["metadata"],
        }));

      const plan = planCoachMessages({ now, lastActivityAt, openCommitments: live, sent, defaultCourseSlug: enabledCourses[0] });

      for (const id of plan.missedCommitmentIds) {
        await db.from("coach_commitments").update({ status: "missed", resolved_at: now.toISOString() }).eq("id", id);
        out.missed += 1;
      }
      if (plan.send.length === 0) continue;

      const prefs = await loadNotificationPrefs(e.founder_id);
      const firstName = (p.full_name ?? "").split(" ")[0] || "there";

      for (const msg of plan.send) {
        const record = async (status: "sent" | "suppressed" | "failed", extra: Row = {}) => {
          await db.from("coach_messages").insert({
            founder_id: e.founder_id,
            company_id: e.company_id,
            kind: msg.kind,
            channel: msg.channel,
            tone,
            status,
            scheduled_at: now.toISOString(),
            sent_at: status === "sent" ? new Date().toISOString() : null,
            metadata: metadataFor(msg),
            ...extra,
          });
          if (status === "sent") out.sent += 1;
          else if (status === "failed") out.failed += 1;
          else out.suppressed += 1;
        };

        // A person at iCFO should reach out. Recorded for the admin view, never sent to the founder.
        if (msg.humanFlag) {
          await record("suppressed", { suppressed_reason: "human_flag_14d" });
          continue;
        }
        if (prefs.pause_all) {
          await record("suppressed", { suppressed_reason: "paused_all" });
          continue;
        }

        const copy = coachMessageCopy(msg, tone);

        if (msg.channel === "in_app") {
          if (!prefs.channel_in_app) {
            await record("suppressed", { suppressed_reason: "in_app_off" });
            continue;
          }
          const note = await createNotification({
            recipientUserId: e.founder_id,
            type: "coach_nudge",
            title: copy.title,
            message: copy.message,
            entityType: "company",
            entityId: e.company_id,
            deepLink: LEARNING_PATH,
          });
          if (note) await record("sent", { notification_id: (note as { id?: string }).id ?? null });
          else await record("failed", { suppressed_reason: "in_app_unavailable" });
          continue;
        }

        // Email.
        if (!prefs.channel_email || !p.email) {
          await record("suppressed", { suppressed_reason: "email_off" });
          continue;
        }
        // Quiet hours: wait for the next run. Nothing is recorded, so it is planned again.
        if (isQuietNow(prefs, now)) continue;

        try {
          const mail = coachReminderEmail({ firstName, title: copy.title, message: copy.message });
          await sendEmail({ to: p.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
          await record("sent");
        } catch {
          await record("failed", { suppressed_reason: "email_error" });
        }
      }
    }
  } catch {
    /* best effort: coach reminders must never break the cron */
  }
  return out;
}

function metadataFor(msg: PlannedMessage): Row {
  const m: Row = {};
  if (msg.stage !== undefined) m.stage = msg.stage;
  if (msg.commitmentId) m.commitment_id = msg.commitmentId;
  if (msg.courseSlug) m.course_slug = msg.courseSlug;
  return m;
}
