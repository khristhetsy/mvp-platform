/**
 * Date and time helpers for the Schedule step of the New campaign wizard. Everything here
 * is plain calendar arithmetic on "YYYY-MM-DD" and "HH:MM" strings. The wizard hands the
 * combined value to platformInputToIso, which reads it as Pacific time.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** Weeks of a month, Sunday first. Days outside the month are null. month is 0 to 11. */
export function monthGrid(year: number, month: number): Array<Array<{ date: string; day: number } | null>> {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<{ date: string; day: number } | null> = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push({ date: `${year}-${pad(month + 1)}-${pad(d)}`, day: d });
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<{ date: string; day: number } | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Moves a { year, month } pair by delta months. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const t = year * 12 + month + delta;
  return { year: Math.floor(t / 12), month: ((t % 12) + 12) % 12 };
}

/** Time choices in 15 minute steps from 00:00 to 23:45. */
export function timeOptions(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) for (const m of [0, 15, 30, 45]) out.push(`${pad(h)}:${pad(m)}`);
  return out;
}

/** "08:15" as "8:15 AM". */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
}

/** The value a datetime-local input would hold, or "" when either part is missing. */
export function combineDateTime(date: string, time: string): string {
  return date && time ? `${date}T${time}` : "";
}

/** The next quarter hour after "YYYY-MM-DDTHH:MM", as the same format. Used as the default time. */
export function nextQuarterHour(local: string): { date: string; time: string } {
  const [date, hm] = local.split("T");
  const [h, m] = (hm ?? "00:00").split(":").map(Number);
  const total = h * 60 + (Math.floor(m / 15) + 1) * 15;
  const nextDay = total >= 24 * 60;
  const mins = total % (24 * 60);
  let d = date;
  if (nextDay) {
    const [y, mo, da] = date.split("-").map(Number);
    const t = new Date(Date.UTC(y, mo - 1, da + 1));
    d = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  }
  return { date: d, time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}` };
}
