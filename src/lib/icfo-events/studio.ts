// Which event a Studio page opens on. Pure: the caller loads the events.

export type StudioEventChoice = { id: string; title: string; status: string; startsAt: string | null };

/** The event asked for, else one that is live, else the next upcoming one,
 *  else the most recent. Returns null when there are no events. */
export function pickStudioEvent<T extends StudioEventChoice>(events: T[], requestedId: string | null | undefined, now: number = Date.now()): T | null {
  if (events.length === 0) return null;
  const asked = requestedId ? events.find((e) => e.id === requestedId) : undefined;
  if (asked) return asked;
  const live = events.find((e) => e.status === "live");
  if (live) return live;
  const upcoming = events
    .filter((e) => e.startsAt && Date.parse(e.startsAt) >= now && e.status !== "draft" && e.status !== "archived")
    .sort((a, b) => Date.parse(a.startsAt ?? "") - Date.parse(b.startsAt ?? ""));
  return upcoming[0] ?? events[0];
}

/** Sessions that belong to a Studio room. Talk shows have their own room;
 *  everything else that is not a draft is in the main room. */
export function sessionsForRoom<T extends { type: string; status: string }>(sessions: T[], room: "main-stage" | "talk-show"): T[] {
  return sessions.filter((s) => s.status !== "draft" && (room === "talk-show" ? s.type === "talk_show" : s.type !== "talk_show"));
}

// ── Playout rules (set per event by staff) ───────────────────────────────────

export type StudioRules = {
  spotlightBreakSeconds: number | null;
};

export const STUDIO_RULE_LIMITS = {
  spotlightBreakSeconds: { column: "spotlight_break_seconds", min: 1, max: 60, label: "Break between pitches" },
} as const;

const intOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);

export function mapStudioRules(row: Record<string, unknown> | null | undefined): StudioRules {
  return {
    spotlightBreakSeconds: intOrNull(row?.spotlight_break_seconds),
  };
}

/** Validate a partial update. A value is a whole number in range, or null to clear it.
 *  Returns the column patch, or an error message naming the field. */
export function buildStudioRulesPatch(body: unknown): { patch: Record<string, number | null> } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Nothing to save." };
  const patch: Record<string, number | null> = {};
  for (const [key, lim] of Object.entries(STUDIO_RULE_LIMITS)) {
    const v = (body as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (v === null) { patch[lim.column] = null; continue; }
    if (typeof v !== "number" || !Number.isInteger(v) || v < lim.min || v > lim.max) {
      return { error: `${lim.label} must be a whole number from ${lim.min} to ${lim.max}.` };
    }
    patch[lim.column] = v;
  }
  return Object.keys(patch).length ? { patch } : { error: "Nothing to save." };
}

/** "2:05" style clock for a number of seconds. */
export function clockFromSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
