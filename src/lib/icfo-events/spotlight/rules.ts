// Founder Spotlight rules: slot math, capacity, upload checks and YouTube
// id parsing. Pure functions, no I/O, so they run in the browser (pre-upload
// checks) and on the server (studio capacity) alike.

/** Longest pitch video a founder may submit. Playback stops here, hard. */
export const SPOTLIGHT_MAX_VIDEO_SECONDS = 60;
/** Pause between one pitch ending and the next starting. */
export const SPOTLIGHT_BREAK_SECONDS = 5;
/** One company's slot in the run of show: the longest pitch plus the break. */
export const SPOTLIGHT_SLOT_SECONDS = SPOTLIGHT_MAX_VIDEO_SECONDS + SPOTLIGHT_BREAK_SECONDS;

/** Full presentation uploads (Professional): private bucket, 500 MB cap. */
export const PRESENTATION_VIDEO_MAX_BYTES = 500 * 1024 * 1024; // matches the session video bucket cap
export const PRESENTATION_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm"];

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

export type FileCheck = { id: "type" | "size"; label: string; ok: boolean; detail: string };

/** The free checks run on the founder's device before a full presentation
 *  upload, and again on the server. Nothing here calls a paid service. */
export function checkPresentationFile(input: { type: string; bytes: number }): FileCheck[] {
  return [
    {
      id: "type",
      label: "MP4, MOV or WebM",
      ok: PRESENTATION_VIDEO_MIME.includes(input.type),
      detail: input.type || "unknown type",
    },
    {
      id: "size",
      label: "500 MB or less",
      ok: input.bytes > 0 && input.bytes <= PRESENTATION_VIDEO_MAX_BYTES,
      detail: `${Math.round(input.bytes / (1024 * 1024))} MB`,
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

/** The five parts every pitch should cover, in order (shown to founders). A
 *  pitch never states an amount being raised. */
export const PITCH_OUTLINE = [
  { id: "hook", label: "Hook and problem" },
  { id: "solution", label: "Solution" },
  { id: "traction", label: "Traction" },
  { id: "market", label: "Market and model" },
  { id: "team", label: "Team" },
] as const;
export type PitchPartId = (typeof PITCH_OUTLINE)[number]["id"];
