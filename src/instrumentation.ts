import { installPlatformTimeZoneDefaults } from "@/lib/time/platform-tz";

/** Runs once per server and edge runtime before any request is handled. */
export function register() {
  // One display time zone (PT) for every page, email and API response.
  installPlatformTimeZoneDefaults();
}
