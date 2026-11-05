export type ClockZone = { label: string; timeZone: string };

/** Offices and markets shown on the Private Market board. */
export const MARKET_ZONES: readonly ClockZone[] = [
  { label: "La Jolla", timeZone: "America/Los_Angeles" },
  { label: "New York", timeZone: "America/New_York" },
  { label: "London", timeZone: "Europe/London" },
  { label: "Paris", timeZone: "Europe/Paris" },
  { label: "Singapore", timeZone: "Asia/Singapore" },
];

/** Wall-clock hour (0 to 23) and minute in a time zone. */
export function zoneTime(date: Date, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: get("hour") % 24, minute: get("minute") };
}

/** Hand angles in degrees clockwise from 12 o'clock. */
export function clockAngles(hour: number, minute: number): { hourDeg: number; minuteDeg: number } {
  return { hourDeg: (hour % 12) * 30 + minute * 0.5, minuteDeg: minute * 6 };
}

export function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
