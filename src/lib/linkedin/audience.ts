// Who a LinkedIn campaign reaches, and how. Pure functions over CRM contact rows.
// A contact already connected on LinkedIn gets a message, not an invite. A contact with an
// email goes to the email sequence first (when the campaign asks for it). Contacts with no
// LinkedIn link, on a do not contact list, or already in another outreach are skipped.

export type TargetRoute = "invite" | "message" | "email_first" | "manual";
export type SkipReason = "no_linkedin_link" | "do_not_contact" | "in_other_outreach";

export type AudienceContact = {
  id: string;
  name: string | null;
  email: string | null;
  linkedin_slug: string | null;
  source: string | null;
  tags: string[] | null;
  raw: unknown;
};

export type AudienceContext = {
  /** Lower case emails on the marketing unsubscribe list. */
  unsubscribedEmails: ReadonlySet<string>;
  /** Contact ids already in another running LinkedIn campaign. */
  inOtherOutreach: ReadonlySet<string>;
  /** Contacts with this tag get a task to send the invite by hand. Case insensitive. */
  highValueTag?: string | null;
  /** Contacts with an email go to the email sequence first. */
  emailFirst: boolean;
};

export type Classified =
  | { contactId: string; route: TargetRoute; slug: string; skip?: undefined }
  | { contactId: string; route?: undefined; skip: SkipReason; slug: string | null };

const DNC_TAG = /^(do[ -]?not[ -]?contact|dnc)$/i;

/** The profile slug in a LinkedIn profile URL, lower case, or null when it is not a profile link. */
export function slugFromUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = /linkedin\.com\/in\/([A-Za-z0-9_%-]+)/i.exec(input.trim());
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).toLowerCase();
  } catch {
    return m[1].toLowerCase();
  }
}

/** True when the contact came from, or was matched to, the LinkedIn connections import. */
export function isConnected(c: Pick<AudienceContact, "source" | "raw">): boolean {
  if (c.source === "linkedin") return true;
  const raw = c.raw;
  return !!raw && typeof raw === "object" && (raw as { linkedin?: unknown }).linkedin != null;
}

export function classifyContact(c: AudienceContact, ctx: AudienceContext): Classified {
  const slug = c.linkedin_slug?.trim().toLowerCase() || null;
  const email = c.email?.trim().toLowerCase() || null;
  const tags = c.tags ?? [];

  if (tags.some((t) => DNC_TAG.test(t.trim())) || (email && ctx.unsubscribedEmails.has(email))) {
    return { contactId: c.id, skip: "do_not_contact", slug };
  }
  if (!slug) return { contactId: c.id, skip: "no_linkedin_link", slug };
  if (ctx.inOtherOutreach.has(c.id)) return { contactId: c.id, skip: "in_other_outreach", slug };

  if (isConnected(c)) return { contactId: c.id, route: "message", slug };
  const hv = ctx.highValueTag?.trim().toLowerCase();
  if (hv && tags.some((t) => t.trim().toLowerCase() === hv)) return { contactId: c.id, route: "manual", slug };
  if (ctx.emailFirst && email) return { contactId: c.id, route: "email_first", slug };
  return { contactId: c.id, route: "invite", slug };
}

export type AudienceSummary = {
  total: number;
  invite: number;
  message: number;
  email_first: number;
  manual: number;
  skipped: number;
  skippedBy: Record<SkipReason, number>;
};

export function summarize(rows: Classified[]): AudienceSummary {
  const s: AudienceSummary = {
    total: rows.length,
    invite: 0,
    message: 0,
    email_first: 0,
    manual: 0,
    skipped: 0,
    skippedBy: { no_linkedin_link: 0, do_not_contact: 0, in_other_outreach: 0 },
  };
  for (const r of rows) {
    if (r.skip) {
      s.skipped += 1;
      s.skippedBy[r.skip] += 1;
    } else {
      s[r.route] += 1;
    }
  }
  return s;
}
