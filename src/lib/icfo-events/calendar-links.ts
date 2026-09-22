// Add-to-calendar link helpers (Google). Pure — safe on server and client.

function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** A Google Calendar "add event" URL. `endISO` defaults to +1h from start. */
export function googleCalUrl(opts: {
  title: string;
  startISO: string;
  endISO?: string | null;
  details?: string | null;
  location?: string | null;
}): string {
  const start = stamp(opts.startISO);
  const end = stamp(opts.endISO || new Date(new Date(opts.startISO).getTime() + 60 * 60 * 1000).toISOString());
  const params = new URLSearchParams({ action: "TEMPLATE", text: opts.title, dates: `${start}/${end}` });
  if (opts.details) params.set("details", opts.details);
  if (opts.location) params.set("location", opts.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Human-readable slot time in the given IANA timezone. */
export function formatSlot(iso: string, timezone: string | null): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: timezone || undefined,
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

/**
 * A downloadable .ics, for everyone who does not live in Google Calendar.
 *
 * A data URL rather than a route: the file is four lines of text built from
 * values the page already has, and an endpoint for it would be one more thing
 * to authorise.
 */
export function icsDataUrl(opts: {
  title: string;
  startISO: string;
  endISO?: string | null;
  url?: string | null;
  location?: string | null;
}): string {
  const end = opts.endISO || new Date(new Date(opts.startISO).getTime() + 30 * 60_000).toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//iCapOS//Events//EN",
    "BEGIN:VEVENT",
    `SUMMARY:${opts.title}`,
    `DTSTART:${stamp(opts.startISO)}`,
    `DTEND:${stamp(end)}`,
    opts.url ? `URL:${opts.url}` : "",
    `LOCATION:${opts.location ?? "Online"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}
