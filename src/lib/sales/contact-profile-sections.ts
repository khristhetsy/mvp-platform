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
  /** Rule id when this value was derived by us (e.g. "derived:angel"), else undefined.
   *  Staff must be able to tell an assumption from something the investor told us. */
  derivedFrom?: string;
  /** Exact label to save an edit under (the synced label if present, else the
   *  canonical Odoo label) so overrides merge with the questionnaire field. */
  saveKey: string;
};
export type ProfileSection = { title: string; fields: ProfileField[] };
export type ContactProfile = { title: string; type: "investor" | "founder" | "generic"; sections: ProfileSection[] };

/** display = label shown; match = keyword(s) to find the synced field; odoo = the
 *  canonical Odoo label to save a *blank* field's edit under.
 *
 *  `match` accepts SEVERAL keywords because one concept can arrive under more than one
 *  Odoo label — operating stage lives under both an entrepreneur-side and an
 *  investor-side phrasing. Listing both folds them into a single row showing the union,
 *  instead of two rows where a value in one makes the other look empty. */
export type FieldDef = {
  display: string; match: string | string[]; odoo: string;
  /** overrides key holding a derivation tag for this field, when one can be derived.
   *  Present → the row can show that its value is an assumption rather than a fact. */
  sourceKey?: string;
};
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
      { display: "Business summary", match: "business summary", odoo: "Entrepreneur business summary" },
      { display: "Industries", match: "industries", odoo: "Industries" },
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
      { display: "Investor business summary", match: "business summary", odoo: "Investor business summary" },
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
      { display: "Industries", match: "industries", odoo: "Industries" },
      // ONE row for one concept. The value may arrive under the investor-side phrasing
      // ("...operational stage?") or the entrepreneur-side one ("Entrepreneur operating
      // stage?") — the matcher unions both, so the profile does too. Edits save to the
      // canonical label when present, which is what enrichment and /fit read.
      { display: "Operating stage", match: ["operating stage", "operational stage"], odoo: "Entrepreneur operating stage?", sourceKey: "_stage_source" },
      { display: "Investment size", match: "investment size", odoo: "Investor investment size?", sourceKey: "_size_source" },
      { display: "Use of funds", match: "use of funds", odoo: "Investor preferences for use of funds?" },
      { display: "Deals per year", match: "deals per year", odoo: "Investor preferences for the number of deals per year?" },
      { display: "Annual revenue range", match: "revenue range", odoo: "Investor preferences for the company with an annual revenue range of?", sourceKey: "_revenue_source" },
      { display: "Annual EBITDA range", match: "ebitda", odoo: "Investor preferences for company with annual EBITDA range of?", sourceKey: "_ebitda_source" },
      // Preferred ranges — mirror the founder's actual ARR/MRR for matching.
      { display: "Preferred ARR range", match: "arr range", odoo: "Investor preferences for the company with an ARR range of?" },
      { display: "Preferred MRR range", match: "mrr range", odoo: "Investor preferences for the company with an MRR range of?" },
      { display: "Management team", match: "management team", odoo: "Investor preferences for the management team?" },
    ],
  },
  // Mirrors the "About me" block on the Odoo investor form.
  {
    title: "About me",
    fields: [
      { display: "Short bio", match: "short bio", odoo: "Investor short bio" },
      { display: "Special skills", match: "special skills", odoo: "Investor special skills" },
      { display: "Work experience", match: "work experience", odoo: "Investor work experience" },
    ],
  },
  // Mirrors the "Social" block on the Odoo investor form. These are Odoo studio fields,
  // so where they're populated they already sync into raw.__profile.extra by label and
  // were previously landing in the catch-all "Other details" group.
  {
    title: "Social",
    fields: [
      { display: "LinkedIn", match: "linkedin", odoo: "Investor linkedin url" },
      { display: "AngelList", match: "angellist", odoo: "Investor angellist url" },
      { display: "Facebook", match: "facebook", odoo: "Investor facebook url" },
      { display: "Twitter / X", match: "twitter", odoo: "Investor twitter url" },
      { display: "Instagram", match: "instagram", odoo: "Investor instagram url" },
      { display: "Other", match: "other url", odoo: "Investor other url" },
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
  derivedSources: Record<string, string> = {},
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
    const keys = (Array.isArray(f.match) ? f.match : [f.match]).map(norm);
    // Consume EVERY synced field matching any keyword and union their values, rather than
    // stopping at the first. With two labels for one concept, taking only the first left
    // the other stranded in "Other details" and made the row look wrong.
    const values: string[] = [];
    let saveKey: string | null = null;
    for (let i = 0; i < extra.length; i++) {
      if (consumed.has(i)) continue;
      if (!keys.some((k) => norm(extra[i].label).includes(k))) continue;
      consumed.add(i);
      // Save under the canonical label when it is one of the matches, so edits stop
      // adding to the split; otherwise keep the synced label so the override lines up.
      if (saveKey === null || extra[i].label === f.odoo) saveKey = extra[i].label;
      for (const v of extra[i].values) if (!values.includes(v)) values.push(v);
    }
    if (saveKey !== null) return { values, saveKey };
    return { values: [], saveKey: f.odoo };
  };

  const sections: ProfileSection[] = schema.map((sec) => ({
    title: sec.title,
    fields: sec.fields.map((f) => {
      const { values, saveKey } = take(f);
      const derivedFrom = f.sourceKey && values.length ? derivedSources[f.sourceKey] : undefined;
      return { label: f.display, values, saveKey, derivedFrom };
    }),
  }));

  const other = extra.filter((_, i) => !consumed.has(i));
  if (other.length) sections.push({ title: "Other details", fields: other.map((f) => ({ ...f, saveKey: f.label })) });

  return { title: type === "investor" ? "Investor Profile" : "Founder Profile", type, sections };
}
