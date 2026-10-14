import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/notifications";
import { sendEmail } from "@/lib/email/send-email";
import { renderEmail } from "@/lib/email/layout";
import { REMINDER_KIND_LABEL, isReminderKind } from "@/lib/reminders/types";
import { formatReminderDue } from "@/lib/reminders/pt";

type DueRow = { id: string; user_id: string; title: string; kind: string; due_at: string };

/**
 * Sends the in-app and email alert for each reminder that has come due. A reminder is claimed
 * first (notified_at set only where it was still empty), so overlapping runs never alert twice.
 */
export async function sendDueReminderAlerts(now: Date = new Date()): Promise<{ due: number; alerted: number }> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data } = await admin
    .from("user_reminders")
    .select("id, user_id, title, kind, due_at")
    .is("done_at", null)
    .is("notified_at", null)
    .lte("due_at", now.toISOString())
    .order("due_at", { ascending: true })
    .limit(200);
  const rows = (data ?? []) as DueRow[];
  if (rows.length === 0) return { due: 0, alerted: 0 };

  const { data: people } = await admin.from("profiles").select("id, email").in("id", Array.from(new Set(rows.map((r) => r.user_id))));
  const emailById = new Map(((people ?? []) as Array<{ id: string; email: string | null }>).map((p) => [p.id, p.email]));

  let alerted = 0;
  for (const row of rows) {
    const { data: claimed } = await admin
      .from("user_reminders")
      .update({ notified_at: now.toISOString() })
      .eq("id", row.id)
      .is("notified_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const kind = isReminderKind(row.kind) ? REMINDER_KIND_LABEL[row.kind] : "Reminder";
    const when = formatReminderDue(row.due_at, now);
    await createNotification({
      recipientUserId: row.user_id,
      type: "reminder_due",
      title: `${kind} due: ${row.title}`,
      message: `This ${kind.toLowerCase()} was due ${when}.`,
      entityType: "user_reminder",
      entityId: row.id,
      dedupeKey: `reminder:${row.id}`,
    });

    const to = emailById.get(row.user_id);
    if (to) {
      const mail = renderEmail({
        audience: "shared",
        subject: `${kind} due: ${row.title}`,
        preheader: `Due ${when}`,
        context: "Reminders",
        eyebrow: "Reminder",
        headline: `Your ${kind.toLowerCase()} is due`,
        intro: row.title,
        blocks: [{ type: "facts", rows: [{ label: "Type", value: kind }, { label: "Due", value: when }] }],
        primary: null,
        footer: { reason: "You get this because you set a reminder in iCapOS." },
      });
      await sendEmail({ to: [to], subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
    }
    alerted += 1;
  }
  return { due: rows.length, alerted };
}
