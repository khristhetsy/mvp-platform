/**
 * Pure rules for registration edits flowing back to the contact record.
 *
 * Main phone and main email are never overwritten from a registration: a
 * different value goes to the second slot (phone2 / email2). The newest value
 * takes the second slot; the one it replaces stays in the timeline entry.
 */

export type ContactSnapshot = {
  name: string | null;
  company: string | null;
  title: string | null;
  country: string | null;
  email: string | null;
  email2: string | null;
  phone: string | null;
  phone2: string | null;
};

export type FieldChange = { field: string; label: string; before: string | null; after: string };

export type ContactPlan = {
  /** Plain fields to write: name, company, job_position, country, and phone/email only when main is empty. */
  patch: { name?: string; company?: string; job_position?: string; country?: string; phone?: string; email?: string; phone2?: string };
  /** Second email lives in overrides (no column). */
  email2?: string;
  changes: FieldChange[];
};

const clean = (v: unknown): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

export function normEmail(v: unknown): string {
  return clean(v).toLowerCase();
}

/** Digits with an optional leading +, so "+61 412-555 019" equals "+61412555019". */
export function normPhone(v: unknown): string {
  const s = clean(v);
  if (!s) return "";
  const plus = s.startsWith("+") ? "+" : "";
  return plus + s.replace(/\D/g, "");
}

const same = (a: unknown, b: unknown) => clean(a).toLowerCase() === clean(b).toLowerCase();

const TEXT_FIELDS: Array<{ answer: string; field: keyof ContactSnapshot; patch: keyof ContactPlan["patch"]; label: string }> = [
  { answer: "name", field: "name", patch: "name", label: "Full name" },
  { answer: "company", field: "company", patch: "company", label: "Company" },
  { answer: "title", field: "title", patch: "job_position", label: "Title" },
  { answer: "country", field: "country", patch: "country", label: "Country" },
];

/**
 * What a submitted registration changes on the contact. Blank answers never
 * clear a stored value. Pure.
 */
export function planContactChanges(before: ContactSnapshot, answers: Record<string, unknown>): ContactPlan {
  const plan: ContactPlan = { patch: {}, changes: [] };

  for (const f of TEXT_FIELDS) {
    const next = clean(answers[f.answer]);
    if (!next || same(next, before[f.field])) continue;
    plan.patch[f.patch] = next;
    plan.changes.push({ field: f.answer, label: f.label, before: before[f.field], after: next });
  }

  const email = normEmail(answers.email);
  if (email && email !== normEmail(before.email) && email !== normEmail(before.email2)) {
    if (!normEmail(before.email)) {
      plan.patch.email = email;
      plan.changes.push({ field: "email", label: "Email", before: null, after: email });
    } else {
      plan.email2 = email;
      plan.changes.push({ field: "email2", label: "Second email", before: before.email2, after: email });
    }
  }

  const phoneRaw = clean(answers.phone);
  const phone = normPhone(phoneRaw);
  if (phone && phone !== normPhone(before.phone) && phone !== normPhone(before.phone2)) {
    if (!normPhone(before.phone)) {
      plan.patch.phone = phoneRaw;
      plan.changes.push({ field: "phone", label: "Phone", before: null, after: phoneRaw });
    } else {
      plan.patch.phone2 = phoneRaw;
      plan.changes.push({ field: "phone2", label: "Second phone", before: before.phone2, after: phoneRaw });
    }
  }

  return plan;
}

/**
 * Merge prefill sources: the first non-empty value wins, in the order given.
 * Returns the answers and which source each came from. Pure.
 */
export function mergePrefill(
  sources: Array<{ name: "profile" | "contact" | "registration"; values: Record<string, unknown> }>,
): { answers: Record<string, unknown>; from: Record<string, "profile" | "contact" | "registration"> } {
  const answers: Record<string, unknown> = {};
  const from: Record<string, "profile" | "contact" | "registration"> = {};
  for (const s of sources) {
    for (const [k, v] of Object.entries(s.values)) {
      if (k in answers) continue;
      const empty = v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);
      if (empty) continue;
      answers[k] = v;
      from[k] = s.name;
    }
  }
  return { answers, from };
}
