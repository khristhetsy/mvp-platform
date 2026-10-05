// Founder Spotlight rules: slot math, capacity, free file checks and YouTube
// id parsing. Pure functions, no I/O, so they run in the browser (pre-upload
// checks) and on the server (studio capacity) alike.

/** Longest pitch video a founder may submit. */
export const SPOTLIGHT_MAX_VIDEO_SECONDS = 180;
/** The AI intro card shown before each pitch. */
export const SPOTLIGHT_INTRO_SECONDS = 12;
/** One company's slot in the run of show: intro card plus the longest pitch. */
export const SPOTLIGHT_SLOT_SECONDS = SPOTLIGHT_MAX_VIDEO_SECONDS + SPOTLIGHT_INTRO_SECONDS;

export const SPOTLIGHT_VIDEO_MAX_BYTES = 500 * 1024 * 1024; // matches the session video bucket cap
export const SPOTLIGHT_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm"];

/** How many companies fit back to back in a number of minutes. */
export function spotlightCapacity(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.floor((minutes * 60) / SPOTLIGHT_SLOT_SECONDS);
}

/** Minutes between two ISO timestamps, or null when either is missing. */
export function minutesBetween(startsAt: string | null, endsAt: string | null): number | null {
  if (!startsAt || !endsAt) return null;
  const ms = Date.parse(endsAt) - Date.parse(startsAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

export type FileCheck = { id: "type" | "size" | "length" | "landscape"; label: string; ok: boolean; detail: string };

/** The free checks run on the founder's device before upload, and shown again
 *  to staff. Nothing here calls a paid service. */
export function checkSpotlightFile(input: {
  type: string;
  bytes: number;
  seconds: number | null;
  width: number | null;
  height: number | null;
}): FileCheck[] {
  const secs = input.seconds == null ? null : Math.round(input.seconds);
  return [
    {
      id: "type",
      label: "MP4, MOV or WebM",
      ok: SPOTLIGHT_VIDEO_MIME.includes(input.type),
      detail: input.type || "unknown type",
    },
    {
      id: "size",
      label: "500 MB or less",
      ok: input.bytes > 0 && input.bytes <= SPOTLIGHT_VIDEO_MAX_BYTES,
      detail: `${Math.round(input.bytes / (1024 * 1024))} MB`,
    },
    {
      id: "length",
      label: "3:00 or less",
      ok: secs != null && secs > 0 && secs <= SPOTLIGHT_MAX_VIDEO_SECONDS,
      detail: secs == null ? "length unreadable" : formatClock(secs),
    },
    {
      id: "landscape",
      label: "Landscape (horizontal)",
      ok: input.width != null && input.height != null && input.width > input.height,
      detail: input.width && input.height ? `${input.width}×${input.height}` : "size unreadable",
    },
  ];
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Accepts a bare 11 character id or any youtube.com / youtu.be link. */
export function parseYouTubeId(input: string): string | null {
  const v = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  try {
    const u = new URL(v);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "studio.youtube.com") {
      const q = u.searchParams.get("v");
      if (q && /^[A-Za-z0-9_-]{11}$/.test(q)) return q;
      const parts = u.pathname.split("/").filter(Boolean);
      const i = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live" || p === "video");
      const id = i >= 0 ? parts[i + 1] : undefined;
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/** The six parts every pitch should cover, in order (shown to founders and
 *  used by the AI review). */
export const PITCH_OUTLINE = [
  { id: "hook", label: "Hook and problem" },
  { id: "solution", label: "Solution" },
  { id: "traction", label: "Traction" },
  { id: "market", label: "Market and model" },
  { id: "team", label: "Team" },
  { id: "ask", label: "The ask" },
] as const;
export type PitchPartId = (typeof PITCH_OUTLINE)[number]["id"];

/** Turns a pasted YouTube captions file (.srt, .vtt or .sbv) or plain text
 *  into one block of spoken words for the AI review. */
export function cleanCaptions(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        l !== "WEBVTT" &&
        !/^\d+$/.test(l) &&
        !/^\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}\s*(-->|,)\s*\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}/.test(l) &&
        !/^(Kind|Language|NOTE)\b/.test(l),
    )
    .map((l) => l.replace(/<[^>]+>/g, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}
