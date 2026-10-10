import {
  JESSICA_AI_LINES,
  JESSICA_COST_LINES,
  JESSICA_COST_VARIANTS,
  JESSICA_FACTS,
  JESSICA_FALLBACK_LINES,
  JESSICA_OBJECTIONS,
  type JessicaChoice,
} from "./config";

/** An open slot as returned by /api/scheduling/slots (ISO instants). */
export interface Slot {
  start: string;
  end: string;
}

export interface DaySlot extends Slot {
  /** Clock time in the display zone, e.g. "8:30 AM". */
  label: string;
}

export interface DayGroup {
  /** yyyy-mm-dd in the display zone. */
  key: string;
  /** Chip text, e.g. "Mon, Oct 12". */
  label: string;
  slots: DaySlot[];
}

/** What a visitor has told Jessica so far. Sent with the booking as intake answers. */
export interface JessicaProfile {
  role?: "Raising" | "Investing";
  stage?: string;
  raise?: string;
  timing?: string;
  checkSize?: string;
  capitalType?: string;
  /** First name, once given. Not sent as an intake answer; it goes on the booking itself. */
  name?: string;
  fullName?: string;
}

/** Intl can emit narrow no-break spaces before AM/PM; plain spaces read the same and compare cleanly. */
function plain(text: string): string {
  return text.replace(/[  ]/g, " ");
}

/**
 * Group open slots by calendar day in `timeZone`, earliest first, keeping the
 * first `maxDays` days that have any time open.
 */
export function groupSlotsByDay(slots: Slot[], timeZone: string, maxDays = 4): DayGroup[] {
  const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });

  const sorted = [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const groups = new Map<string, DayGroup>();
  for (const slot of sorted) {
    const when = new Date(slot.start);
    if (Number.isNaN(when.getTime())) continue;
    const key = keyFmt.format(when);
    let group = groups.get(key);
    if (!group) {
      if (groups.size >= maxDays) continue;
      group = { key, label: plain(dayFmt.format(when)), slots: [] };
      groups.set(key, group);
    }
    group.slots.push({ start: slot.start, end: slot.end, label: plain(timeFmt.format(when)) });
  }
  return [...groups.values()];
}

/** "Monday, October 12 at 8:30 AM PT" for the confirmation message. */
export function formatSlotWhen(startIso: string, timeZone: string, zoneLabel: string): string {
  const when = new Date(startIso);
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" }).format(when);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(when);
  return plain(`${day} at ${time} ${zoneLabel}`);
}

/** Map a chip the visitor tapped to the two paths the conversation takes. */
export function normalizeRole(choice: string): "Raising" | "Investing" {
  return /invest|deals/i.test(choice) ? "Investing" : "Raising";
}

export function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) && value.trim().length <= 254;
}

/** Intake answers saved on the booking, in the order Jessica asked them. Empty answers are left out. */
export function bookingAnswers(profile: JessicaProfile): Array<{ label: string; value: string }> {
  const rows: Array<[string, string | undefined]> = [
    ["Raising or investing", profile.role],
    ["Company stage", profile.stage],
    ["Raise size", profile.raise],
    ["Time to close", profile.timing],
    ["Check size", profile.checkSize],
    ["Capital type", profile.capitalType],
  ];
  return rows
    .filter((row): row is [string, string] => Boolean(row[1]?.trim()))
    .map(([label, value]) => ({ label, value: value.trim().slice(0, 1000) }));
}

export type JessicaReply =
  | { kind: "cost"; id: "cost"; lines: string[]; variants: string[][] }
  | { kind: "ai"; lines: string[] }
  | { kind: "objection"; id: string; lines: string[]; variants: string[][]; choices?: Record<string, JessicaChoice>; bridge?: string }
  | { kind: "fact"; lines: string[] }
  | { kind: "unknown"; lines: string[] };

const COST = /\b(cost|price|pricing|fee|fees|how much)\b/i;
const AI = /\b(bot|robot|ai|a\.i\.|chatgpt|automated|human|real person|actual person|a person)\b/i;

/**
 * Pick the answer for something the visitor typed. Honest by design: asked
 * whether she is a bot or a person, Jessica says she is an AI assistant.
 */
export function matchReply(text: string): JessicaReply {
  if (AI.test(text)) return { kind: "ai", lines: JESSICA_AI_LINES };
  // Objections first: "no upfront fees" would otherwise read as a plain cost question.
  for (const objection of JESSICA_OBJECTIONS) {
    if (objection.match.test(text)) {
      return {
        kind: "objection",
        id: objection.id,
        lines: objection.lines,
        variants: objection.variants ?? [],
        choices: objection.choices,
        bridge: objection.bridge,
      };
    }
  }
  if (COST.test(text)) return { kind: "cost", id: "cost", lines: JESSICA_COST_LINES, variants: JESSICA_COST_VARIANTS };
  for (const fact of JESSICA_FACTS) {
    if (fact.match.test(text)) return { kind: "fact", lines: fact.lines };
  }
  return { kind: "unknown", lines: JESSICA_FALLBACK_LINES };
}

export type JessicaAiMode = "CLOSE" | "QUALIFY" | "DONE";

/**
 * One close, then qualify. After times have been offered and the visitor keeps
 * typing instead of picking one, the next two AI replies end with a question,
 * not another push. Anything new from the visitor (a chip, an answer) resets it.
 */
export function aiMode(input: { booked: boolean; offered: number; sinceNew: number }): JessicaAiMode {
  if (input.booked) return "DONE";
  if (input.offered > 0 && input.sinceNew < 2) return "QUALIFY";
  return "CLOSE";
}

/** The assumptive time offer, built from the real open days. Wording changes each time so it never repeats word for word. */
export function timeOfferLine(dayLabels: string[], offered: number, zoneLabel: string): string {
  const [a, b] = dayLabels;
  if (!a) return `Which day works for you? Times are ${zoneLabel}.`;
  if (!b) return offered === 0 ? `I have ${a} open, ${zoneLabel}. What time suits you?` : `${a} is still open, ${zoneLabel}. Pick a time?`;
  const variants = [
    `I have ${a} or ${b} open, ${zoneLabel}. Which works for you?`,
    `${a} and ${b} are still open, ${zoneLabel}. Which one?`,
    `${a} or ${b}, ${zoneLabel}?`,
  ];
  return variants[Math.min(offered, variants.length - 1)];
}

export interface JessicaAiReply {
  lines: string[];
  bridge: string;
  question: string;
}

/** Shape check on what the reply route returns. Anything odd becomes null and the chat uses its fallback. */
export function parseAiReply(data: unknown): JessicaAiReply | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const lines = Array.isArray(d.lines) ? d.lines.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 160)).slice(0, 2) : [];
  if (lines.length === 0) return null;
  const bridge = typeof d.bridge === "string" ? d.bridge.trim().slice(0, 160) : "";
  const question = typeof d.question === "string" ? d.question.trim().slice(0, 160) : "";
  return { lines, bridge, question };
}

/**
 * Never the same words twice. The first time a scripted reply is used it is
 * said as written; each time the same one comes back, the next variant is
 * used. Returns null once every wording has been used, so the chat can hand
 * the question to the AI with a note to answer it a different way.
 */
export function pickWording(lines: string[], variants: string[][], timesUsed: number): string[] | null {
  const all = [lines, ...variants];
  return timesUsed < all.length ? all[timesUsed] : null;
}

/** Loose key for "is this the same question again?" */
export function questionKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\b(a|an|the|do|does|you|your|guys|is|are|what|how|much|please|can|me|i|we|it)\b/g, "").replace(/\s+/g, " ").trim();
}

/** True when what the visitor typed when asked for a name reads like a name, not a question or a request. */
export function looksLikeName(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 60 || /[?@]/.test(v)) return false;
  if (v.split(/\s+/).length > 3) return false;
  return !/\b(send|info|what|how|can|could|you|your|do|does|are|is|fee|fees|cost|price|charge|the|me|us|please|why|when|where|who|not|no|yes|hi|hello|thanks)\b/i.test(v);
}
