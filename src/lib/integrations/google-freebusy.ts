import { isGoogleOAuthConfigured } from "@/lib/integrations/google-env";
import type { TimeInterval } from "@/lib/scheduling/types";

const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";

type FreeBusyResponse = {
  calendars?: { primary?: { busy?: Array<{ start: string; end: string }> } };
  error?: { message?: string };
};

export function isGoogleFreeBusyConfigured() {
  return isGoogleOAuthConfigured();
}

/**
 * Query the user's primary-calendar busy intervals between timeMin/timeMax.
 * Returns ISO intervals suitable for the availability engine.
 */
export async function getGoogleBusyIntervals(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<TimeInterval[]> {
  const response = await fetch(FREEBUSY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
  });

  const payload = (await response.json().catch(() => null)) as FreeBusyResponse | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to query Google free/busy.");
  }

  const busy = payload?.calendars?.primary?.busy ?? [];
  return busy
    .filter((b) => b.start && b.end)
    .map((b) => ({ start: b.start, end: b.end }));
}
