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

export type ProfileField = { label: string; values: string[] };
export type ProfileSection = { title: string; fields: ProfileField[] };
export type ContactProfile = { title: string; type: "investor" | "founder" | "generic"; sections: ProfileSection[] };

type FieldDef = { display: string; match: string };
type SectionDef = { title: string; fields: FieldDef[] };

const FOUNDER_SCHEMA: SectionDef[] = [
  {
    title: "Entrepreneur information",
    fields: [
      { display: "How did you hear about us?", match: "how did you hear" },
      { display: "If other, referred you", match: "referred you" },
      { display: "iCFO capital partner", match: "icfo capital partner" },
      { display: "Assigned agent", match: "assigned agent" },
      { display: "Contact preference", match: "contact preference" },
    ],
  },
  {
    title: "Seeking",
    fields: [
      { display: "Type of investor(s)", match: "type of investor" },
      { display: "Type(s) of capital", match: "type" },
      { display: "Amount of capital", match: "amount" },
      { display: "Use of funds", match: "use of funds" },
    ],
  },
  {
    title: "Agent field (internal)",
    fields: [
      { display: "Note", match: "'s note" },
      { display: "Request", match: "'s request" },
      { display: "Pitch frame to use", match: "pitch" },
    ],
  },
];

const INVESTOR_SCHEMA: SectionDef[] = [
  {
    title: "Investor information",
    fields: [
      { display: "How did you hear about us?", match: "how did you hear" },
      { display: "If other, referred you", match: "referred you" },
      { display: "iCFO capital partner", match: "icfo capital partner" },
      { display: "Assigned agent", match: "assigned agent" },
      { display: "Contact preference", match: "contact preference" },
    ],
  },
  {
    title: "Investor rating",
    fields: [
      { display: "Active investor", match: "active investor" },
      { display: "Participating in meetings & events", match: "participating in meeting" },
      { display: "Responding to email & phone", match: "responding to email" },
      { display: "Turnaround period", match: "turnaround" },
    ],
  },
  {
    title: "Investor preferences",
    fields: [
      { display: "Investment size", match: "investment size" },
      { display: "Use of funds", match: "use of funds" },
      { display: "Deals per year", match: "deals per year" },
      { display: "Annual revenue range", match: "revenue range" },
      { display: "Annual EBITDA range", match: "ebitda" },
      { display: "Management team", match: "management team" },
    ],
  },
  {
    title: "Agent field (internal)",
    fields: [
      { display: "Note", match: "'s note" },
      { display: "Request", match: "'s request" },
      { display: "Quick notes", match: "quick" },
    ],
  },
];

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

function detectTypeFromLabels(extra: ProfileField[]): "investor" | "founder" | "generic" {
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
  extra: ProfileField[],
  membership?: string | null,
): ContactProfile {
  const type = typeFromMembership(membership) ?? detectTypeFromLabels(extra);
  if (type === "generic") {
    return { title: "Additional details", type, sections: extra.length ? [{ title: "Details", fields: extra }] : [] };
  }

  const schema = type === "investor" ? INVESTOR_SCHEMA : FOUNDER_SCHEMA;
  const consumed = new Set<number>();
  const take = (keyword: string): string[] => {
    const k = norm(keyword);
    for (let i = 0; i < extra.length; i++) {
      if (consumed.has(i)) continue;
      if (norm(extra[i].label).includes(k)) {
        consumed.add(i);
        return extra[i].values;
      }
    }
    return [];
  };

  const sections: ProfileSection[] = schema.map((sec) => ({
    title: sec.title,
    fields: sec.fields.map((f) => ({ label: f.display, values: take(f.match) })),
  }));

  const other = extra.filter((_, i) => !consumed.has(i));
  if (other.length) sections.push({ title: "Other details", fields: other });

  return { title: type === "investor" ? "Investor Profile" : "Founder Profile", type, sections };
}
