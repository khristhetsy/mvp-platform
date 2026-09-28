/**
 * Activity burndown for an IR project — client-safe, pure. For each week from the project
 * start: how many to-dos (ir_activities) were open at the end of that week, i.e. created
 * by then and not yet done. The ideal line runs from the first week's figure to zero at
 * the project's end date. Only weeks up to today carry an actual value.
 */
export type BurndownPoint = { weekEnd: string; open: number | null; ideal: number };

const DAY = 86_400_000;

export function activityBurndown(
  activities: Array<{ created_at: string; done_at: string | null }>,
  startDate: string, endDate: string, now: Date = new Date(),
): BurndownPoint[] {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T23:59:59Z`).getTime();
  if (!(end > start)) return [];
  const weeks: number[] = [];
  for (let t = start + 7 * DAY - 1; t < end + 7 * DAY; t += 7 * DAY) weeks.push(Math.min(t, end));
  const openAt = (t: number) => activities.filter((a) => new Date(a.created_at).getTime() <= t && (!a.done_at || new Date(a.done_at).getTime() > t)).length;
  const first = openAt(weeks[0]);
  const span = weeks[weeks.length - 1] - weeks[0] || 1;
  return weeks.map((t) => ({
    weekEnd: new Date(t).toISOString().slice(0, 10),
    open: t - 7 * DAY + 1 <= now.getTime() ? openAt(Math.min(t, now.getTime())) : null,
    ideal: Math.max(0, Math.round((first * (1 - (t - weeks[0]) / span)) * 10) / 10),
  }));
}
