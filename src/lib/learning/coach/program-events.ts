import { pacificDate } from "@/lib/learning/coach/plan-items";

/**
 * Program events live above the lesson's real steps, so summarizeCourseSteps (latest event per step)
 * never mistakes an answer for a step check in. Writing them needs the event kinds added by migration
 * 20261020120000_coach_program_events.sql; until it runs, these inserts fail quietly and the lesson still works.
 */
export const PROGRAM_EVENT_INDEX = { opened: 100, recall: 101, answer: 102, test: 103, commit: 104 } as const;
export type ProgramEventKind = keyof typeof PROGRAM_EVENT_INDEX;

export function isProgramEventKind(v: unknown): v is ProgramEventKind {
  return typeof v === "string" && v in PROGRAM_EVENT_INDEX;
}

/** coach_commitments.due_choice only knows today, tomorrow and this week; the exact time lives in due_at. */
export function dueChoiceFor(dueAt: Date, now: Date = new Date()): "today" | "tomorrow" | "this_week" {
  const today = pacificDate(now.toISOString());
  const due = pacificDate(dueAt.toISOString());
  if (due <= today) return "today";
  const tomorrow = pacificDate(new Date(now.getTime() + 86_400_000).toISOString());
  if (due === tomorrow) return "tomorrow";
  return "this_week";
}
