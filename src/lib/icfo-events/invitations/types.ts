/**
 * Event Hub invitations: shared shapes and defaults. Pure, safe on the client.
 *
 * A campaign invites founders, investors and advisors to one or more events.
 * Each role is offered a fixed set of activities; the campaign can switch any
 * of them off. Advisors register as "service" (Service Provider), the existing
 * attendee type closest to an advisor.
 */

export const INVITE_ROLES = ["founder", "investor", "advisor"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

/** The registration attendee type each invite role registers as. */
export const ATTENDEE_TYPE_FOR_ROLE: Record<InviteRole, "founder" | "investor" | "service"> = {
  founder: "founder",
  investor: "investor",
  advisor: "service",
};

export const ROLE_LABEL: Record<InviteRole, string> = {
  founder: "Founders",
  investor: "Investors",
  advisor: "Advisors",
};

export type Offer = { key: string; label: string; blurb: string; icon: string };

/** What each role is offered, in the order shown in emails and on the form. */
export const OFFERS: Record<InviteRole, Offer[]> = {
  founder: [
    { key: "present", label: "Present to the investor network", blurb: "Apply for a presentation slot in front of our investor network.", icon: "presentation" },
    { key: "networking", label: "Networking sessions", blurb: "Meet investors matched to your industry and stage.", icon: "users" },
    { key: "talk_show", label: "Attend the talk show", blurb: "A live conversation with our investor panelists.", icon: "mic" },
  ],
  investor: [
    { key: "prescreened", label: "Prescreened presentations", blurb: "Founders vetted by iCFO before they present.", icon: "search" },
    { key: "one_on_one", label: "One on one founder meetings", blurb: "Request time with the founders you want to meet.", icon: "calendar" },
    { key: "panelist", label: "Talk show panelist", blurb: "Join our panel and share your view.", icon: "mic" },
    { key: "networking", label: "Networking sessions", blurb: "Matched by thesis and check size.", icon: "users" },
  ],
  advisor: [
    { key: "networking", label: "Networking sessions", blurb: "Meet founders and investors in your sectors.", icon: "users" },
    { key: "talk_show", label: "Attend the talk show", blurb: "Watch the investor panel live.", icon: "mic" },
  ],
};

/** Registration answer key each offer maps to, when the form has one. */
export const OFFER_ANSWER_KEY: Record<string, string | undefined> = {
  present: "applyToPresent",
  one_on_one: "oneOnOneMeetings",
  panelist: "talkShowPanelist",
};

export type Audience = {
  role: InviteRole;
  listId: string | null;
  offers: string[];
  /** Optional overrides; blank means the default copy. */
  subject?: string | null;
  intro?: string | null;
};

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "paused", "done"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/* ------------------------------------------------------------ live numbers */

export const STAT_KEYS = ["investors", "founders", "advisors", "matches", "presentations", "spotlights", "panelists"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABEL: Record<StatKey, string> = {
  investors: "Investors registered",
  founders: "Founders registered",
  advisors: "Advisors registered",
  matches: "Matches made",
  presentations: "Presentations",
  spotlights: "Founder spotlights",
  panelists: "Investor panelists, talk show",
};

/** Where each number comes from, shown in the admin settings. */
export const STAT_SOURCE: Record<StatKey, string> = {
  investors: "Registrations, type investor (self and staff added)",
  founders: "Registrations, type founder (self and staff added)",
  advisors: "Registrations, type service provider",
  matches: "Founder and investor registrations sharing at least one sector",
  presentations: "Presenters on the event lineup",
  spotlights: "Approved founder spotlight videos (not built yet)",
  panelists: "Talk show guests with role Panelist",
};

/** Shown instead of the count while it is below its minimum. */
export const STAT_PLACEHOLDER: Record<StatKey, string> = {
  investors: "Opening soon",
  founders: "Opening soon",
  advisors: "Opening soon",
  matches: "Opening soon",
  presentations: "Booking now",
  spotlights: "Opening soon",
  panelists: "Announcing soon",
};

export const DEFAULT_STAT_MIN: Record<StatKey, number> = {
  investors: 10,
  founders: 10,
  advisors: 5,
  matches: 10,
  presentations: 5,
  spotlights: 3,
  panelists: 2,
};

export type StatSettings = {
  per: "event" | "combined";
  items: Record<StatKey, { show: boolean; min: number }>;
};

export function defaultStatSettings(): StatSettings {
  const items = {} as StatSettings["items"];
  for (const k of STAT_KEYS) items[k] = { show: true, min: DEFAULT_STAT_MIN[k] };
  return { per: "combined", items };
}

/** Fill gaps in stored settings with the defaults. Pure. */
export function normalizeStatSettings(raw: unknown): StatSettings {
  const base = defaultStatSettings();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as { per?: unknown; items?: Record<string, { show?: unknown; min?: unknown }> };
  if (r.per === "event" || r.per === "combined") base.per = r.per;
  for (const k of STAT_KEYS) {
    const it = r.items?.[k];
    if (!it) continue;
    if (typeof it.show === "boolean") base.items[k].show = it.show;
    const min = Number(it.min);
    if (Number.isFinite(min) && min >= 0) base.items[k].min = Math.floor(min);
  }
  return base;
}

/** Raw counts; null when a number has no source yet. */
export type StatCounts = Record<StatKey, number | null>;

export type StatTile = { key: StatKey; label: string; value: string; counted: boolean };

/** Which number leads for each role (outlined, first, and in the subject). */
export const LEAD_STAT: Record<InviteRole, StatKey> = {
  founder: "investors",
  investor: "founders",
  advisor: "matches",
};

/** Tile order per role: the lead first, the rest after. */
export const STAT_ORDER: Record<InviteRole, StatKey[]> = {
  founder: ["investors", "panelists", "matches", "presentations", "spotlights", "founders"],
  investor: ["founders", "presentations", "spotlights", "matches", "investors", "panelists"],
  advisor: ["matches", "founders", "investors", "presentations", "spotlights", "panelists"],
};

/**
 * Turn counts into display tiles. A hidden number is left out; a number below
 * its minimum (or with no source) shows its placeholder instead. Never estimates.
 * Pure.
 */
export function statTiles(counts: StatCounts, settings: StatSettings, order: StatKey[]): StatTile[] {
  const out: StatTile[] = [];
  for (const k of order) {
    const s = settings.items[k];
    if (!s?.show) continue;
    const n = counts[k];
    const counted = n !== null && n >= s.min && n > 0;
    out.push({ key: k, label: STAT_LABEL[k], value: counted ? n.toLocaleString("en-US") : STAT_PLACEHOLDER[k], counted });
  }
  return out;
}
