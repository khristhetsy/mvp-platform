/**
 * Turns a coach commitment into the body of a Task or a Calendar event.
 *
 * Nothing here calls the network or writes anything. The founder clicks "Add to Tasks" or
 * "Add to Calendar" on the step card, and the card sends these bodies to the platform's existing
 * /api/tasks and /api/calendar/events routes, with their own rules. The event is local only: no
 * attendees and no Meet link, so nothing is sent to Google or to anyone else.
 */
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

const EVENT_MINUTES = 30;

export type PlanItemInput = { stepTitle: string; dueAt: string };

/** YYYY-MM-DD for the due moment as the founder sees it in Pacific time. */
export function pacificDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: PLATFORM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function taskBody(input: PlanItemInput) {
  return {
    title: `AI IR Coach: ${input.stepTitle}`.slice(0, 500),
    description: "Added from your AI IR Coach commitment.",
    priority: "medium" as const,
    due_date: pacificDate(input.dueAt),
    context_type: "personal" as const,
    task_type: "investor_outreach" as const,
  };
}

export function calendarBody(input: PlanItemInput) {
  const start = new Date(input.dueAt);
  const end = new Date(start.getTime() + EVENT_MINUTES * 60_000);
  return {
    title: `AI IR Coach: ${input.stepTitle}`.slice(0, 300),
    description: "Time you set aside in AI IR Coach.",
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    timezone: PLATFORM_TZ,
  };
}
