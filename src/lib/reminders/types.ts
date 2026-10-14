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
  /** "sales" rows are Sales tasks shown in the clock. They are completed in Sales and can't be deleted here. */
  source?: "reminder" | "sales";
  /** Sales tasks only have a due date, so the clock shows the day without a time. */
  date_only?: boolean;
  /** Who the Sales task is about, shown under the title. */
  context?: string | null;
  /** Where a click on the row goes (Sales tasks open the contact Tasks tab). */
  href?: string;
};

export function isReminderKind(value: unknown): value is ReminderKind {
  return typeof value === "string" && (REMINDER_KINDS as readonly string[]).includes(value);
}
