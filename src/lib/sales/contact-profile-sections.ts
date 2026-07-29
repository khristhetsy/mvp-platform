/**
 * Organizes a contact's synced "Additional details" (label → values) into the
 * same sections Odoo shows, titled by contact type: "Investor Profile" or
 * "Founder Profile". Type is detected from the field labels themselves
 * ("Investor …" vs "Entrepreneur …"), falling back to a generic list.
 *
 * Every mapped field is included even when empty, so the profile reads as a
 * complete, consistent record for every contact of that type. Unmapped fields
 * land in a trailing "Other details" section so nothing is lost.
 */

export type ProfileField = { label: string; values: string[] };
export type ProfileSection = { title: string; fields: ProfileField[] };
export type ContactProfile = { title: string; type: "investor" | "founder" | "generic"; sections: ProfileSection[] };

type SectionSpec = { title: string; match: string[] };

// Keyword groups, first match wins (order matters). Keywords are the distinctive
// parts of the Odoo labels, matched case-insensitively as substrings.
const INVESTOR_SPEC: SectionSpec[] = [
  { title: "Investor information", match: ["how did you hear", "referred you", "icfo capital partner", "assigned agent", "contact preference"] },
  { title: "Investor rating", match: ["active investor", "participating in meeting", "responding to email", "turnaround period"] },
  { title: "Investor preferences", match: ["investment size", "use of funds", "deals per year", "revenue range", "ebitda", "management team", "special skills", "short bio", "work experience"] },
  { title: "Agent field (internal)", match: ["note", "request", "quick notes", "pitch"] },
];

const FOUNDER_SPEC: SectionSpec[] = [
  { title: "Entrepreneur information", match: ["how did you hear", "referred you", "icfo capital partner", "assigned agent", "contact preference"] },
  { title: "Seeking", match: ["seeking type of investor", "seeking type", "seeking amount", "use of funds"] },
  { title: "Agent field (internal)", match: ["note", "request", "quick notes", "pitch"] },
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function detectType(extra: ProfileField[]): "investor" | "founder" | "generic" {
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

export function groupContactProfile(extra: ProfileField[]): ContactProfile {
  const type = detectType(extra);
  if (type === "generic") {
    return { title: "Additional details", type, sections: extra.length ? [{ title: "Details", fields: extra }] : [] };
  }

  const spec = type === "investor" ? INVESTOR_SPEC : FOUNDER_SPEC;
  const buckets = new Map<string, ProfileField[]>(spec.map((s) => [s.title, []]));
  const other: ProfileField[] = [];

  for (const f of extra) {
    const l = norm(f.label);
    const section = spec.find((s) => s.match.some((k) => l.includes(k)));
    if (section) buckets.get(section.title)!.push(f);
    else other.push(f);
  }

  const sections: ProfileSection[] = spec
    .map((s) => ({ title: s.title, fields: buckets.get(s.title)! }))
    .filter((s) => s.fields.length > 0);
  if (other.length) sections.push({ title: "Other details", fields: other });

  return { title: type === "investor" ? "Investor Profile" : "Founder Profile", type, sections };
}
