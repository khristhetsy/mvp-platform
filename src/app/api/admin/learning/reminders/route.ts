import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { getPendingReminders, scheduleReminder, sendReminder } from "@/lib/learning/reminders";

const sendReminderSchema = z.object({
  reminderId: z.string().uuid(),
});

const scheduleAndSendSchema = z.object({
  founderId: z.string().uuid(),
  companyId: z.string().uuid(),
  type: z.enum(["inactivity_nudge", "milestone_celebration", "weekly_digest"]).default("inactivity_nudge"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const reminders = await getPendingReminders();
  return NextResponse.json({ reminders });
}

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => ({}));

  const sendParsed = sendReminderSchema.safeParse(body);
  if (sendParsed.success) {
    try {
      const result = await sendReminder(sendParsed.data.reminderId);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send reminder.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const scheduleParsed = scheduleAndSendSchema.safeParse(body);
  if (scheduleParsed.success) {
    try {
      const reminder = await scheduleReminder({
        founderId: scheduleParsed.data.founderId,
        companyId: scheduleParsed.data.companyId,
        type: scheduleParsed.data.type,
        scheduledAt: new Date().toISOString(),
        metadata: scheduleParsed.data.metadata,
      });
      const result = await sendReminder(reminder.id);
      return NextResponse.json({ scheduled: reminder, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to schedule and send reminder.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid reminder request." }, { status: 400 });
}
