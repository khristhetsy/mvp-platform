/**
 * Milestone math for an IR project — pure, client-safe. A term is N months of 28 days;
 * each month holds four 7-day weeks. Week numbering runs across the whole term
 * (Month 2 starts at Week 5) so a task title like "Michael Doyle Week 22" is unambiguous.
 */

export type MilestoneKind = "month" | "week";
export type MilestoneDraft = {
  kind: MilestoneKind;
  label: string;
  startsOn: string;   // YYYY-MM-DD
  endsOn: string;     // YYYY-MM-DD, exclusive of the next milestone (last day inclusive = endsOn - 1)
  sortOrder: number;  // 1-based within its kind
  monthIndex: number; // 1-based month this belongs to (a month's own index for kind=month)
};

export const DAYS_PER_MONTH = 28;
export const WEEKS_PER_MONTH = 4;
export const DAYS_PER_WEEK = 7;
export const TERM_OPTIONS = [4, 5, 6] as const;

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Every month and week for a term, in order. `endsOn` is the day after the last day. */
export function generateMilestones(startDate: string, termMonths: number): MilestoneDraft[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("startDate must be YYYY-MM-DD");
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 12) throw new Error("termMonths out of range");
  const out: MilestoneDraft[] = [];
  for (let m = 1; m <= termMonths; m++) {
    const mStart = addDays(startDate, (m - 1) * DAYS_PER_MONTH);
    out.push({ kind: "month", label: `Month ${m}`, startsOn: mStart, endsOn: addDays(mStart, DAYS_PER_MONTH), sortOrder: m, monthIndex: m });
    for (let w = 1; w <= WEEKS_PER_MONTH; w++) {
      const n = (m - 1) * WEEKS_PER_MONTH + w;
      const wStart = addDays(mStart, (w - 1) * DAYS_PER_WEEK);
      out.push({ kind: "week", label: `Week ${n}`, startsOn: wStart, endsOn: addDays(wStart, DAYS_PER_WEEK), sortOrder: n, monthIndex: m });
    }
  }
  return out;
}

/** The milestone (of a kind) that contains `date`, or null when outside the term. */
export function milestoneOn<T extends { startsOn: string; endsOn: string } | { starts_on: string; ends_on: string }>(list: T[], date: string): T | null {
  const bounds = (m: T) => ("startsOn" in m ? [m.startsOn, m.endsOn] : [m.starts_on, m.ends_on]);
  return list.find((m) => { const [s, e] = bounds(m); return s <= date && date < e; }) ?? null;
}

/** "Apr 22 to May 19, 2026" — last day inclusive. */
export function formatRange(startsOn: string, endsOn: string): string {
  const last = addDays(endsOn, -1);
  const f = (iso: string, withYear: boolean) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC", ...(withYear ? { year: "numeric" } : {}) });
  return `${f(startsOn, false)} to ${f(last, true)}`;
}
