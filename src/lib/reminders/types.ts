/** Reminders behind the clock icon in the top bar. Client safe. */
export const REMINDER_KINDS = ["task", "todo", "follow_up", "call"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  task: "Task",
  todo: "To-do",
  follow_up: "Follow up",
  call: "Call",
};

export type Reminder = {
  id: string;
  title: string;
  kind: ReminderKind;
  due_at: string;
  done_at: string | null;
};

export function isReminderKind(value: unknown): value is ReminderKind {
  return typeof value === "string" && (REMINDER_KINDS as readonly string[]).includes(value);
}
