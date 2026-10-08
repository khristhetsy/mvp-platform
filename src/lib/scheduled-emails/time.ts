/**
 * Schedule send times, shared by the picker (browser) and the server. All
 * times are Pacific time (PT). Pure, so the picker and the tests agree.
 */
import { toPlatformInput, fromPlatformInput } from "@/lib/time/platform-input";

/** Earliest and latest times a send can be scheduled for. */
export const MIN_LEAD_MS = 60_000;
export const MAX_LEAD_MS = 366 * 86_400_000;

export function validSendAt(sendAtIso: string, now: Date = new Date()): string | null {
  const t = new Date(sendAtIso).getTime();
  if (!sendAtIso || Number.isNaN(t)) return "Pick a date and time first.";
  if (t < now.getTime() + MIN_LEAD_MS) return "Pick a time in the future.";
  if (t > now.getTime() + MAX_LEAD_MS) return "Pick a time within the next year.";
  return null;
}

/** "YYYY-MM-DD" in PT, a number of days after the given instant's PT date. */
function ptDatePlus(now: Date, days: number): string {
  const today = toPlatformInput(now).slice(0, 10);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ptWeekday(now: Date): number {
  const today = toPlatformInput(now).slice(0, 10);
  return new Date(`${today}T12:00:00Z`).getUTCDay();
}

export type SendPreset = { label: string; iso: string };

/** Tomorrow 8:00 AM, tomorrow 1:00 PM and next Monday 8:00 AM, all PT. */
export function sendPresets(now: Date = new Date()): SendPreset[] {
  const at = (date: string, time: string) => fromPlatformInput(`${date}T${time}`)!.toISOString();
  const tomorrow = ptDatePlus(now, 1);
  const daysToMonday = ((8 - ptWeekday(now)) % 7) || 7;
  return [
    { label: "Tomorrow morning", iso: at(tomorrow, "08:00") },
    { label: "Tomorrow afternoon", iso: at(tomorrow, "13:00") },
    { label: "Monday morning", iso: at(ptDatePlus(now, daysToMonday), "08:00") },
  ];
}

/** "Fri Oct 9, 8:00 AM PT". */
export function formatSendAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  return `${s} PT`;
}
