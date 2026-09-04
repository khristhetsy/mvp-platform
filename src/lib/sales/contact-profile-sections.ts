/**
 * Organizes a contact's synced "Additional details" into a type-titled profile:
 * "Founder Profile" (Entrepreneur membership) or "Investor Profile" (Investor
 * membership). Type comes from the contact's Membership first, falling back to
 * the field labels, then a generic list.
 *
 * A fixed per-type schema lists every field for that type in order, so the
 * profile reads as a complete record — fields with no synced value come back
 * empty (rendered as "—"). Any synced field not in the schema lands in a
 * trailing "Other details" section so nothing is lost.
 */

/** Raw synced field (input). */
export type ExtraField = { label: string; values: string[] };

export type ProfileField = {
  label: string;
  values: string[];
  /** Exact label to save an edit under (the synced label if present, else the
   *  canonical Odoo label) so overrides merge with the questionnaire field. */
  saveKey: string;
};
export type ProfileSection = { title: string; fields: ProfileField[] };
export type ContactProfile = { title: string; type: "investor" | "founder" | "generic"; sections: ProfileSection[] };

/** display = label shown; match = keyword to find the synced field; odoo = the
 *  canonical Odoo label to save a *blank* field's edit under. */
export type FieldDef = { display: string; match: string; odoo: string };
type SectionDef = { title: string; fields: FieldDef[] };

const FOUNDER_SCHEMA: SectionDef[] = [
  {
    title: "Entrepreneur information",
    fields: [
      { display: "How did you hear about us?", match: "how did you hear", odoo: "Entrepreneur: How did you hear about us?" },
      { display: "If other, referred you", match: "referred you", odoo: "Entrepreneur: If other, please tell us who referred you" },
      { display: "iCFO capital partner", match: "icfo capital partner", odoo: "Entrepreneur: iCFO capital partner" },
      { display: "Assigned agent", match: "assigned agent", odoo: "Entrepreneur assigned agent" },
      { display: "Contact preference", match: "contact preference", odoo: "Entrepreneur contact preference" },
    ],
  },
  {
    title: "Seeking",
    fields: [
      { display: "Type of investor(s)", match: "type of investor", odoo: "Entrepreneur seeking type of investor(s)?" },
      { display: "Type(s) of capital", match: "seeking type(s) of capital", odoo: "Entrepreneur seeking type(s) of capital?" },
      { display: "Amount of capital", match: "amount", odoo: "Entrepreneur seeking amount of capital?" },
      { display: "Use of funds", match: "use of funds", odoo: "Entrepreneur use of funds?" },
      { display: "Business entity", match: "business entity", odoo: "Entrepreneur type(s) of business entity?" },
      { display: "Active investor preference", match: "preferences for active", odoo: "Entrepreneur preferences for active investor?" },
    ],
  },
  {
    title: "Company & stage",
    fields: [
      { display: "Funding stage", match: "funding stage", odoo: "Entrepreneur funding stage?" },
      { display: "Operating stage", match: "operating stage", odoo: "Entrepreneur operating stage?" },
      { display: "Annual revenue size", match: "annual revenue size", odoo: "Entrepreneur annual revenue size?" },
      { display: "Annual EBITDA", match: "ebitda", odoo: "Entrepreneur annual EBITDA?" },
      // Actuals — mirror the investor's preferred ARR/MRR range so matching can compare.
      { display: "ARR", match: "annual recurring revenue", odoo: "Entrepreneur annual recurring revenue (ARR)?" },
      { display: "MRR", match: "monthly recurring revenue", odoo: "Entrepreneur monthly recurring revenue (MRR)?" },
      { display: "Management team", match: "management team experience", odoo: "Entrepreneur management team experience?" },
    ],
  },
  {
    title: "Highlights",
    fields: [
      { display: "Five key highlights", match: "five key highlights", odoo: "Entrepreneur five key highlights" },
    ],
  },
  {
    title: "Agent field (internal)",
    fields: [
      { display: "Note", match: "'s note", odoo: "Entrepreneur's note" },
      { display: "Request", match: "'s request", odoo: "Entrepreneur's request" },
      { display: "Pitch frame to use", match: "pitch", odoo: "Entrepreneur pitch frame to use" },
    ],
  },
];

const INVESTOR_SCHEMA: SectionDef[] = [
  {
    title: "Investor information",
    fields: [
      { display: "How did you hear about us?", match: "how did you hear", odoo: "Investor: How did you hear about us?" },
      { display: "If other, referred you", match: "referred you", odoo: "Investor: If other, please tell us who referred you" },
      { display: "iCFO capital partner", match: "icfo capital partner", odoo: "Investor: iCFO capital partner" },
      { display: "Assigned agent", match: "assigned agent", odoo: "Investor assigned agent" },
      { display: "Contact preference", match: "contact preference", odoo: "Investor contact preference" },
    ],
  },
  {
    title: "Investor rating",
    fields: [
      { display: "Active investor", match: "active investor", odoo: "Active investor" },
      { display: "Participating in meetings & events", match: "participating in meeting", odoo: "Participating in meeting and event" },
      { display: "Responding to email & phone", match: "responding to email", odoo: "Responding to email and phone call" },
      { display: "Turnaround period", match: "turnaround", odoo: "Turnaround period" },
    ],
  },
  {
    title: "Investor thesis",
    fields: [
      { display: "Investment size", match: "investment size", odoo: "Investor investment size?" },
      { display: "Use of funds", match: "use of funds", odoo: "Investor preferences for use of funds?" },
      { display: "Deals per year", match: "deals per year", odoo: "Investor preferences for the number of deals per year?" },
      { display: "Annual revenue range", match: "revenue range", odoo: "Investor preferences for the company with an annual revenue range of?" },
      { display: "Annual EBITDA range", match: "ebitda", odoo: "Investor preferences for company with annual EBITDA range of?" },
      // Preferred ranges — mirror the founder's actual ARR/MRR for matching.
      { display: "Preferred ARR range", match: "arr range", odoo: "Investor preferences for the company with an ARR range of?" },
      { display: "Preferred MRR range", match: "mrr range", odoo: "Investor preferences for the company with an MRR range of?" },
      { display: "Management team", match: "management team", odoo: "Investor preferences for the management team?" },
    ],
  },
  {
    title: "Agent field (internal)",
    fields: [
      { display: "Note", match: "'s note", odoo: "Investor's note" },
      { display: "Request", match: "'s request", odoo: "Investor's request" },
      { display: "Quick notes", match: "quick", odoo: "Investor quick notes" },
    ],
  },
];

/** Every schema field across both profile types (for option-list mapping). */
export const ALL_SCHEMA_FIELDS: FieldDef[] = [...FOUNDER_SCHEMA, ...INVESTOR_SCHEMA].flatMap((s) => s.fields);

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function typeFromMembership(membership: string | null | undefined): "investor" | "founder" | null {
  if (!membership) return null;
  const s = membership.toLowerCase();
  if (s.includes("investor")) return "investor";
  if (s.includes("entrepreneur") || s.includes("founder")) return "founder";
  return null;
}

function detectTypeFromLabels(extra: ExtraField[]): "investor" | "founder" | "generic" {
  let inv = 0;
  let fnd = 0;
  for (const f of extra) {
    const l = norm(f.label);
    if (l.startsWith("investor")) inv++;
    else if (l.startsWith("entrepreneur")) fnd++;
  }
  if (inv === 0 && fnd === 0) return "generic";
  return inv >= fnd ? "investor" : "founder";
}

export function groupContactProfile(
  extra: ExtraField[],
  membership?: string | null,
): ContactProfile {
  const type = typeFromMembership(membership) ?? detectTypeFromLabels(extra);
  if (type === "generic") {
    return {
      title: "Additional details",
      type,
      sections: extra.length
        ? [{ title: "Details", fields: extra.map((f) => ({ ...f, saveKey: f.label })) }]
        : [],
    };
  }

  const schema = type === "investor" ? INVESTOR_SCHEMA : FOUNDER_SCHEMA;
  const consumed = new Set<number>();
  // Returns the synced values + the label to save under (synced label if the
  // field exists, else the canonical Odoo label so a blank field still saves).
  const take = (f: FieldDef): { values: string[]; saveKey: string } => {
    const k = norm(f.match);
    for (let i = 0; i < extra.length; i++) {
      if (consumed.has(i)) continue;
      if (norm(extra[i].label).includes(k)) {
        consumed.add(i);
        return { values: extra[i].values, saveKey: extra[i].label };
      }
    }
    return { values: [], saveKey: f.odoo };
  };

  const sections: ProfileSection[] = schema.map((sec) => ({
    title: sec.title,
    fields: sec.fields.map((f) => {
      const { values, saveKey } = take(f);
      return { label: f.display, values, saveKey };
    }),
  }));

  const other = extra.filter((_, i) => !consumed.has(i));
  if (other.length) sections.push({ title: "Other details", fields: other.map((f) => ({ ...f, saveKey: f.label })) });

  return { title: type === "investor" ? "Investor Profile" : "Founder Profile", type, sections };
}
