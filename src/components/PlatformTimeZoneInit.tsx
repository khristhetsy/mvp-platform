"use client";

import { installPlatformTimeZoneDefaults } from "@/lib/time/platform-tz";

// Runs when the browser loads the app bundle, before React renders, so every
// date on screen is shown in Pacific time whatever the viewer's own zone is.
installPlatformTimeZoneDefaults();

export function PlatformTimeZoneInit() {
  return null;
}
