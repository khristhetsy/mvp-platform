/**
 * Demo slot generation (spec §9). Slots are generated server-side in the FIRM's
 * timezone (iCFO is in Southern California), the next six weekdays × six times,
 * returned as UTC ISO strings. The client renders them in the visitor's local
 * timezone; storage is UTC. DST-correct via the Intl offset trick (no date lib).
 */

export const FIRM_TIMEZONE = "America/Los_Angeles";

// Six daily slots, firm local time (24h): 9, 10, 11, 13, 14, 15.
const SLOT_HOURS = [9, 10, 11, 13, 14, 15];
const WEEKDAYS_WANTED = 6;

/** Convert a wall-clock time in `timeZone` to the correct UTC Date (DST-aware). */
function zonedWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]));
  // What the guess instant reads as, as wall time, in the target zone:
  const asZone = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour === "24" ? "0" : parts.hour), Number(parts.minute));
  const offset = asZone - utcGuess;
  return new Date(utcGuess - offset);
}

/** Today's Y/M/D as seen in the firm timezone. */
function firmToday(timeZone: string): { year: number; month: number; day: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

/** Next six firm-timezone weekdays × six times, as future UTC ISO strings. */
export function generateDemoSlots(): string[] {
  const now = Date.now();
  const { year, month, day } = firmToday(FIRM_TIMEZONE);
  const slots: string[] = [];
  let weekdaysCollected = 0;
  // Start tomorrow; walk forward until we have six weekdays.
  for (let offset = 1; offset <= 14 && weekdaysCollected < WEEKDAYS_WANTED; offset++) {
    const base = new Date(Date.UTC(year, month - 1, day + offset));
    const dow = base.getUTCDay(); // 0 Sun … 6 Sat
    if (dow === 0 || dow === 6) continue;
    weekdaysCollected++;
    const y = base.getUTCFullYear(), m = base.getUTCMonth() + 1, d = base.getUTCDate();
    for (const h of SLOT_HOURS) {
      const utc = zonedWallTimeToUtc(y, m, d, h, 0, FIRM_TIMEZONE);
      if (utc.getTime() > now) slots.push(utc.toISOString());
    }
  }
  return slots;
}
