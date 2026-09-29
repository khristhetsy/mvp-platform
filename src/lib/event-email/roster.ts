/**
 * Who's presenting — turning the event roster into email sections.
 *
 * The roster already reaches the email as merge data and is then ignored. The
 * awkward part is `role_label`: it is free text, and four code paths spell the
 * same role differently ("Founder showcase" from the presenters dropdown,
 * "Founder Showcase" from an accepted invitation, "founder showcase" from an
 * approved application with no label chosen). Matching on the exact string
 * would put three identical headings in one email, so everything here groups
 * on a normalised key.
 *
 * Pure: no database, no network, no HTML.
 */

import type { EventMergeData } from "./merge";

export type RosterPerson = EventMergeData["presenters"][number];

/**
 * Role reduced to something comparable — lowercased, punctuation dropped,
 * whitespace and underscores collapsed. "Founder Showcase", "founder_showcase"
 * and "Founder  showcase" all land on `founder showcase`.
 */
export function normalizeRole(label: string): string {
  return label
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type RoleGroup = "showcase" | "exhibitor" | "guest_ceo" | "investor" | "presenter";

/**
 * Known spellings per group. Anything unrecognised falls to `presenter` rather
 * than being dropped: a person on the roster always appears somewhere, even if
 * whoever added them invented a role.
 *
 * "founder" is deliberately NOT a showcase alias — it is the invitation role
 * for someone who answers in their own portal, which is a different thing.
 */
const ROLE_ALIASES: Record<RoleGroup, string[]> = {
  showcase: ["founder showcase", "showcase"],
  exhibitor: ["exhibitor", "exhibitors"],
  guest_ceo: ["guest ceo", "guest", "ceo guest"],
  investor: ["investor", "investors", "guest investor"],
  presenter: ["presenter", "panelist", "panellist", "speaker", "founder"],
};

export function roleGroupOf(label: string): RoleGroup {
  const key = normalizeRole(label);
  for (const [group, aliases] of Object.entries(ROLE_ALIASES) as [RoleGroup, string[]][]) {
    if (aliases.includes(key)) return group;
  }
  return "presenter";
}

/** The line that names the company. Falls back to the person, never to blank. */
export function companyLine(p: RosterPerson): string {
  return p.company.trim() || p.name.trim();
}

/** The person under the company — name, and role when it adds anything. */
export function personLine(p: RosterPerson, withRole = true): string {
  const role = withRole ? p.role.trim() : "";
  return role && normalizeRole(role) !== normalizeRole(p.name) ? `${p.name} · ${role}` : p.name;
}

/** What a Showcase card says about the company. */
export function pitchLine(p: RosterPerson): string {
  return (p.companySummary || p.bio || "").trim();
}

export type RosterSections = {
  /** Leads the email: on the programme, not attached to a session. */
  companies: RosterPerson[];
  showcase: RosterPerson[];
  exhibitors: RosterPerson[];
};

/**
 * Split the roster into the sections the email renders.
 *
 * Anyone attached to a session is left out: they appear under that session in
 * the agenda instead, and listing them twice would read as two separate people.
 */
export function rosterSections(all: RosterPerson[]): RosterSections {
  const loose = all.filter((p) => !p.sessionId);
  return {
    companies: loose.filter((p) => roleGroupOf(p.role) === "presenter"),
    showcase: loose.filter((p) => roleGroupOf(p.role) === "showcase"),
    exhibitors: loose.filter((p) => roleGroupOf(p.role) === "exhibitor"),
  };
}

export type SessionGuest = { role: string; person: RosterPerson };

/**
 * The people billed under one session, guest CEOs first, then investors, then
 * everyone else — the order they'd be introduced in.
 */
export function sessionGuests(all: RosterPerson[], sessionId: string): SessionGuest[] {
  const rank: Record<RoleGroup, number> = { guest_ceo: 0, investor: 1, showcase: 2, presenter: 3, exhibitor: 4 };
  const labelFor: Partial<Record<RoleGroup, string>> = { guest_ceo: "Guest CEO", investor: "Investor" };
  return all
    .filter((p) => p.sessionId === sessionId)
    .map((p) => {
      const group = roleGroupOf(p.role);
      return { group, role: labelFor[group] ?? (p.role.trim() || "Guest"), person: p };
    })
    .sort((a, b) => rank[a.group] - rank[b.group])
    .map(({ role, person }) => ({ role, person }));
}

/** Rows of at most `n` — one email `columns` block per row. */
export function chunk<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}
