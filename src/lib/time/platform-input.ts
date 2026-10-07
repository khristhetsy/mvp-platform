/**
 * Date and time inputs (<input type="datetime-local">) in the platform time
 * zone. What a person types is read as Pacific time, and a stored instant is
 * shown back as Pacific wall clock time, whatever zone their browser is in.
 */
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/cron/zoned-schedule";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

/** Stored instant → "YYYY-MM-DDTHH:MM" in PT for a datetime-local input. Empty for no value. */
export function toPlatformInput(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return utcToZonedLocal(d, PLATFORM_TZ).slice(0, 16);
}

/** "YYYY-MM-DDTHH:MM" typed as PT → the instant. Null when empty or invalid. */
export function fromPlatformInput(local: string | null | undefined): Date | null {
  if (!local) return null;
  return zonedLocalToUtc(local.slice(0, 16), PLATFORM_TZ);
}

/** fromPlatformInput as an ISO string, or null. */
export function platformInputToIso(local: string | null | undefined): string | null {
  return fromPlatformInput(local)?.toISOString() ?? null;
}
