// Human labels + the option set offered for each reminder's cadence dropdown,
// derived from the type's default cadence family.

export function cadenceLabel(token: string | null): string {
  if (!token) return "—";
  const daily = /^daily_(\d{2})(\d{2})$/.exec(token);
  if (daily) return `Daily at ${daily[1]}:${daily[2]}`;
  const afterH = /^after_(\d+)h$/.exec(token);
  if (afterH) return `After ${afterH[1]}h`;
  const afterD = /^after_(\d+)d$/.exec(token);
  if (afterD) return `After ${afterD[1]} days`;
  const wk = /^weekly_([a-z]{3})$/.exec(token);
  if (wk) return `Weekly · ${wk[1].charAt(0).toUpperCase()}${wk[1].slice(1)}`;
  return token;
}

export function cadenceOptions(defaultCadence: string | null): string[] {
  if (!defaultCadence) return [];
  if (defaultCadence.startsWith("daily_")) return ["daily_0600", "daily_0630", "daily_0700", "daily_0800"];
  if (/^after_\d+h$/.test(defaultCadence)) return ["after_2h", "after_4h", "after_8h"];
  if (/^after_\d+d$/.test(defaultCadence)) return ["after_3d", "after_5d", "after_7d", "after_14d"];
  if (defaultCadence.startsWith("weekly_")) return ["weekly_mon", "weekly_wed", "weekly_fri"];
  return [defaultCadence];
}

export const DIGEST_TIMES = ["06:00", "06:30", "07:00", "07:30", "08:00", "09:00"];
export const TIMEZONES = [
  "Europe/Paris", "Europe/London", "America/New_York", "America/Chicago",
  "America/Denver", "America/Los_Angeles", "Asia/Singapore", "Australia/Sydney",
];
