/**
 * "Send message" on a Share Project record or a weekly task (Odoo's message-to-followers).
 * The message is kept on the record as a staff-only note and the followers — project owner
 * and the record's assignee, minus the sender — get an in-app notification with a deep link.
 */
import { createNotification } from "@/lib/notifications/notifications";
import { createNote, nameMap } from "@/lib/ir/db";

export const MESSAGE_PREFIX = "Message · ";

export async function sendRecordMessage(i: { projectId: string; matchId: string | null; taskId: string | null; body: string; followers: Array<string | null | undefined>; senderId: string; recordLabel: string; deepLink: string }): Promise<{ notified: number }> {
  const text = i.body.trim();
  if (!text) throw new Error("Write the message.");
  await createNote({ projectId: i.projectId, matchId: i.matchId, body: `${MESSAGE_PREFIX}${text}`, founderVisible: false, createdBy: i.senderId });
  const sender = (await nameMap([i.senderId])).get(i.senderId) ?? "A teammate";
  const recipients = [...new Set(i.followers.filter((x): x is string => Boolean(x) && x !== i.senderId))];
  let notified = 0;
  for (const uid of recipients) {
    const n = await createNotification({ recipientUserId: uid, actorUserId: i.senderId, type: "ir_message", title: `${sender} · ${i.recordLabel}`, message: text.slice(0, 500), deepLink: i.deepLink, entityType: i.matchId ? "ir_match" : "ir_task", entityId: i.matchId ?? i.taskId ?? null }).catch(() => null);
    if (n) notified++;
  }
  return { notified };
}
