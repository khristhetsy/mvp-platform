/**
 * Merge duplicate Sales Hub contacts: types and pure helpers shared by the Merge dialog and the
 * server (see merge-contacts.ts for the database side).
 */

export const MERGE_FIELDS = [
  { key: "name", label: "Name" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "type", label: "Type" },
  { key: "profile", label: "Investor profile" },
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number]["key"];

export type MergeCandidate = {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  type: string;
  source: string | null;
  createdOn: string | null;
  tags: string[];
  /** Filled investor-profile facets (investor type, industries, stages, capital, entity). */
  profileFields: number;
  profileSummary: string[];
  refs: { irMatches: number; lists: number; projects: number };
};

/** A company field that just repeats the person's name or email isn't a firm. */
function realCompany(c: MergeCandidate): boolean {
  const v = (c.company ?? "").trim().toLowerCase();
  return !!v && v !== (c.name ?? "").trim().toLowerCase() && v !== (c.email ?? "").trim().toLowerCase();
}
/** A name that is really an email address isn't a name. */
function realName(c: MergeCandidate): boolean {
  const v = (c.name ?? "").trim();
  return !!v && !v.includes("@");
}

function valueOf(c: MergeCandidate, f: MergeField): string {
  switch (f) {
    case "profile": return c.profileFields ? `${c.profileFields} field${c.profileFields === 1 ? "" : "s"} filled` : "";
    case "type": return c.type === "other" ? "" : c.type;
    default: return (c[f] ?? "").toString().trim();
  }
}
export function mergeFieldValue(c: MergeCandidate, f: MergeField): string { return valueOf(c, f); }

/**
 * Which record to keep and, per field, whose value to take. Keep the record with the fullest
 * investor profile, then an investor over "other", then the oldest; per field take the kept
 * record's value unless it's empty (or a placeholder such as an email in the name field).
 * Pass keepId when the user has picked the record to keep; the field defaults follow it.
 */
export function defaultMergeChoice(cands: MergeCandidate[], keepId?: string): { keepId: string; fields: Record<MergeField, string> } {
  if (cands.length < 2) throw new Error("Pick at least two contacts to merge.");
  const keep = cands.find((c) => c.id === keepId) ?? [...cands].sort((a, b) =>
    b.profileFields - a.profileFields
    || Number(b.type === "investor" || b.type === "founder") - Number(a.type === "investor" || a.type === "founder")
    || (a.createdOn ?? "9999").localeCompare(b.createdOn ?? "9999"))[0];
  const ordered = [keep, ...cands.filter((c) => c.id !== keep.id)];
  const good = (c: MergeCandidate, f: MergeField) =>
    f === "company" ? realCompany(c) : f === "name" ? realName(c) : f === "profile" ? c.profileFields > 0 : !!valueOf(c, f);
  const fields = {} as Record<MergeField, string>;
  for (const { key } of MERGE_FIELDS) {
    const pick = key === "profile"
      ? [...ordered].sort((a, b) => b.profileFields - a.profileFields)[0]
      : ordered.find((c) => good(c, key)) ?? keep;
    fields[key] = pick.id;
  }
  return { keepId: keep.id, fields };
}

export type DuplicateGroup = { email: string; count: number; members: Array<Pick<MergeCandidate, "id" | "name" | "company" | "email" | "phone" | "type" | "source" | "createdOn" | "profileFields">> };
