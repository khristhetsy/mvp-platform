// Manual outreach reminders for Stage 3 founders.
//
// The Outreach step is complete only once BOTH automated and manual outreach
// are used. Founders tend to stop after automated, so this keeps reminding them
// until their first manual email goes out, then stops for good.
//
// Cadence (counted from the first reminder, run by the daily founder-nudges cron):
//   Day 0   bell
//   Day 3   bell + email
//   Day 7   email + an in-app tip from the AI assistant
//   Weekly  email, until the first manual send
//
// State lives on stage_gate_reminders under gate_key "manual_outreach"
// (sends_count is the step in the cadence). Best effort: never throws into the cron.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { NOT_A_BROKER_DEALER, renderEmail } from "@/lib/email/layout";
import { loadOutreachStatus } from "@/lib/founder/outreach-status";

export const MANUAL_OUTREACH_GATE_KEY = "manual_outreach";
const DAY_MS = 24 * 60 * 60 * 1000;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");
export const MANUAL_OUTREACH_PATH = "/founder/deploy?step=outreach&mode=manual";

type Touch = { bell: boolean; email: boolean; aiTip: boolean; nextInDays: number };

/** What the Nth reminder (0-based) sends, and when the next one is due. */
export function manualOutreachTouch(sendsCount: number): Touch {
  if (sendsCount <= 0) return { bell: true, email: false, aiTip: false, nextInDays: 3 };
  if (sendsCount === 1) return { bell: true, email: true, aiTip: false, nextInDays: 4 };
  if (sendsCount === 2) return { bell: false, email: true, aiTip: true, nextInDays: 7 };
  return { bell: false, email: true, aiTip: false, nextInDays: 7 };
}

export function manualOutreachEmail(firstName: string, automatedRunning: boolean) {
  const url = `${SITE_URL}${MANUAL_OUTREACH_PATH}`;
  return renderEmail({
    audience: "founder",
    subject: "Finish your outreach step: send your first manual email",
    preheader: "Email investors you already know to complete Stage 3.",
    eyebrow: "Your raise · Stage 3",
    headline: "Finish your outreach step",
    intro: automatedRunning
      ? `Hi ${firstName}, your automated outreach is running. To complete Stage 3, email the investors you already know from your contacts.`
      : `Hi ${firstName}, to complete Stage 3, email the investors you already know from your contacts.`,
    blocks: [
      {
        type: "checklist",
        title: "How manual outreach works",
        items: [
          { label: "Add investors you know, or use My contacts", done: false },
          { label: "Tick who to contact", done: false },
          { label: "Pick a template or draft with AI, then send", done: false },
          { label: "Track replies and move warm investors to your CRM", done: false },
        ],
      },
    ],
    primary: { label: "Start manual outreach", url },
    footer: {
      reason: "You're receiving this because manual outreach is still open on your iCapOS Stage 3 checklist. It stops automatically after your first manual email.",
      preferencesUrl: `${SITE_URL}/founder/settings`,
      lines: [NOT_A_BROKER_DEALER],
    },
  });
}

type ReminderRow = { sends_count: number | null; next_send_at: string | null; resolved_at: string | null; paused: boolean | null };

export async function runManualOutreachReminderPass(limit = 300): Promise<{ sent: number; resolved: number }> {
  let sent = 0;
  let resolved = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as unknown as SupabaseClient<any>;

    // Founders in Stage 3 (engine stage "deploy").
    const { data: profs } = await db
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("journey_stage", "deploy")
      .limit(limit);
    const founders = ((profs ?? []) as Array<{ id: string; email: string | null; full_name: string | null; role: string | null }>).filter(
      (p) => !isInternalAccount(p),
    );
    if (founders.length === 0) return { sent, resolved };

    const { data: comps } = await db
      .from("companies")
      .select("id, founder_id")
      .in("founder_id", founders.map((f) => f.id));
    const companyByFounder = new Map<string, string>();
    for (const c of (comps ?? []) as Array<{ id: string; founder_id: string | null }>) {
      if (c.founder_id && !companyByFounder.has(c.founder_id)) companyByFounder.set(c.founder_id, c.id);
    }

    const now = Date.now();
    for (const f of founders) {
      const companyId = companyByFounder.get(f.id);
      if (!companyId) continue;

      const { data: rowData } = await db
        .from("stage_gate_reminders")
        .select("sends_count, next_send_at, resolved_at, paused")
        .eq("company_id", companyId)
        .eq("gate_key", MANUAL_OUTREACH_GATE_KEY)
        .maybeSingle();
      const row = rowData as ReminderRow | null;
      if (row?.resolved_at) continue;

      const status = await loadOutreachStatus(companyId);
      const stamp = new Date().toISOString();

      // First manual email went out: stop for good.
      if (status.manual.started) {
        if (row) {
          await db
            .from("stage_gate_reminders")
            .update({ resolved_at: stamp, next_send_at: null, updated_at: stamp })
            .eq("company_id", companyId)
            .eq("gate_key", MANUAL_OUTREACH_GATE_KEY);
          resolved += 1;
        }
        continue;
      }

      if (row?.paused) continue;
      const due = !row?.next_send_at || new Date(row.next_send_at).getTime() <= now;
      if (!due) continue;

      const count = row?.sends_count ?? 0;
      const touch = manualOutreachTouch(count);
      const firstName = (f.full_name ?? "").split(" ")[0] || "there";
      const automatedRunning = status.automated.state === "running";

      if (touch.bell) {
        await createNotification({
          recipientUserId: f.id,
          type: "manual_outreach_nudge",
          title: "Finish your outreach step",
          message: automatedRunning
            ? "Automated is running. Email investors you already know to complete Stage 3."
            : "Email investors you already know to complete Stage 3.",
          entityType: "company",
          entityId: companyId,
          deepLink: MANUAL_OUTREACH_PATH,
        });
      }
      if (touch.aiTip) {
        await createNotification({
          recipientUserId: f.id,
          type: "manual_outreach_nudge",
          title: "Tip: let AI draft your first manual email",
          message: "Open Manual outreach, tick a few investors you know, and tap Draft with AI. You review every word before it sends.",
          entityType: "company",
          entityId: companyId,
          deepLink: MANUAL_OUTREACH_PATH,
        });
      }
      if (touch.email && f.email) {
        const mail = manualOutreachEmail(firstName, automatedRunning);
        try {
          await sendEmail({ to: f.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
        } catch {
          /* still advance the cadence; the bell went out */
        }
      }

      await db.from("stage_gate_reminders").upsert(
        {
          company_id: companyId,
          founder_id: f.id,
          gate_key: MANUAL_OUTREACH_GATE_KEY,
          paused: false,
          sends_count: count + 1,
          last_sent_at: stamp,
          next_send_at: new Date(now + touch.nextInDays * DAY_MS).toISOString(),
          resolved_at: null,
          updated_at: stamp,
        },
        { onConflict: "company_id,gate_key" },
      );
      sent += 1;
    }
  } catch {
    /* best effort: reminders must never break the cron */
  }
  return { sent, resolved };
}
