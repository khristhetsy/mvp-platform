/**
 * The agenda, shaped for an email.
 *
 * Sessions carry the abstract written for the event page — several hundred
 * words of it — and the email was printing all of it, so a four-session agenda
 * ran about a thousand words before the register button. An agenda in an email
 * says what is on; the page it links to says what it is about.
 *
 * Pure: no HTML, no database.
 */

import type { EventMergeData } from "./merge";
import type { SessionWeight } from "./palette";

export type Session = EventMergeData["sessions"][number];

export const ABSTRACT_MAX = 120;

/**
 * One line of abstract: the first sentence, capped at `max` characters and cut
 * on a word boundary. Display only — the session keeps its full text for the
 * event page and the booklet, which have room for it.
 */
export function trimAbstract(text: string, max: number = ABSTRACT_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  // First sentence, when there is one and it isn't itself an essay.
  const stop = clean.search(/[.!?](\s|$)/);
  const first = stop > 0 ? clean.slice(0, stop + 1) : clean;
  if (first.length <= max) return first;

  // Otherwise cut on a word boundary — never mid-word, never a bare "…".
  const cut = first.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-–—]$/, "")}…`;
}

/**
 * A session whose title announces a booth rather than a slot — "Exhibitors -
 * NAI Technology". These are typed `founder_showcase` in the data, which is
 * why they show up in the agenda wearing a Founder Showcase badge over a
 * company's marketing paragraph.
 *
 * Detecting them here is a patch over that mislabel, not a repair of it: the
 * repair is to delete the sessions and put the companies on the roster as
 * exhibitors.
 */
export function isExhibitSession(title: string): boolean {
  return /^\s*exhibit(or|ors|s)?\s*[-–—:]/i.test(title);
}

/** The company named after the "Exhibitors -" prefix. */
export function exhibitName(title: string): string {
  return title.replace(/^\s*exhibit(or|ors|s)?\s*[-–—:]\s*/i, "").trim() || title.trim();
}

/**
 * The order an agenda is always read in: the keynote opens the room, the talk
 * show follows, then everything else, and booths last.
 *
 * Fixed rather than derived. `position` still orders sessions of the same kind
 * — so admin reordering works — but it cannot put a workshop above the keynote.
 * No session is featured: they are equal rows, and whichever has guests shows
 * them.
 */
const TYPE_ORDER = ["keynote", "talk_show", "panel", "workshop", "founder_showcase"];

export function orderSessions(sessions: Session[]): Session[] {
  const rank = (s: Session) => {
    const i = TYPE_ORDER.indexOf(s.type);
    return i === -1 ? TYPE_ORDER.length : i;
  };
  return sessions
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map(({ s }) => s);
}

export type AgendaRow = {
  session: Session;
  weight: SessionWeight;
  label: string;
  abstract: string;
};

export type Agenda = {
  /** Every real session, in the fixed order. No session is featured. */
  rows: AgendaRow[];
  /** Booth sessions, merged to one line naming the companies. */
  exhibits: string[];
};

const LABEL: Record<string, string> = {
  talk_show: "Talk show",
  founder_showcase: "Showcase",
  keynote: "Keynote",
  panel: "Panel",
  workshop: "Workshop",
};

function labelOf(s: Session): string {
  return LABEL[s.type] ?? s.type.replace(/_/g, " ");
}

/** The agenda split into what it is, in the order it should be read. */
export function buildAgenda(sessions: Session[]): Agenda {
  return {
    rows: orderSessions(sessions.filter((s) => !isExhibitSession(s.title))).map((s) => ({
      session: s,
      weight: "programmed" as SessionWeight,
      label: labelOf(s),
      abstract: trimAbstract(s.abstract),
    })),
    exhibits: sessions.filter((s) => isExhibitSession(s.title)).map((s) => exhibitName(s.title)),
  };
}
