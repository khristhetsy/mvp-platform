/**
 * Versioned registration questions — the pure half.
 *
 * Validation, diffing and the options-linking rule live here with no database
 * and no network, so the parts that can silently lose answers are directly
 * testable.
 */

import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";
import {
  REGISTRATION_COUNTRIES,
  type RegistrationField,
} from "@/lib/icfo-events/registration-fields";
import type { AttendeeType } from "@/lib/icfo-events/registration-intake";

export type FieldKind = RegistrationField["kind"];

/**
 * A field as stored. `optionsFrom` names a shared list instead of copying it:
 * sectors are the same vocabulary events are tagged with, so duplicating them
 * into this table would let the two drift apart silently.
 *
 * `include` narrows a linked list to a subset, by stable value (a sector slug).
 * Absent means all of them — so a set saved before this existed still offers
 * everything, which is why it is optional rather than defaulted on write.
 */
export type StoredField = {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  optionsFrom?: "sectors" | "countries";
  include?: string[];
  required?: boolean;
};

export type RegistrationRole = { key: AttendeeType; label: string };

export type FieldSet = {
  version: string;
  roles: RegistrationRole[];
  common: StoredField[];
  byType: Record<string, StoredField[]>;
};

/**
 * One entry of a shared list. `value` is what `include` stores and must stay
 * stable; `label` is what a registrant reads and is free to be reworded.
 * Countries have no slug of their own, so there the two are the same string.
 */
export type SharedOption = { value: string; label: string };

/** Lists a field can borrow rather than copy, with their stable values. */
export function sharedOptionList(name: StoredField["optionsFrom"]): SharedOption[] {
  if (name === "sectors") return EVENT_SECTORS.map((s) => ({ value: s.slug, label: s.label }));
  if (name === "countries") return REGISTRATION_COUNTRIES.map((c) => ({ value: c, label: c }));
  return [];
}

/** The labels of a shared list, in order. */
export function sharedOptions(name: StoredField["optionsFrom"]): string[] {
  return sharedOptionList(name).map((o) => o.label);
}

/**
 * The options a field actually offers: a linked field narrowed by `include`,
 * or its own copied list. Keeps the shared list's order rather than the order
 * the values were ticked in.
 */
export function resolvedOptionsFor(f: StoredField): string[] {
  if (!f.optionsFrom) return f.options ?? [];
  const all = sharedOptionList(f.optionsFrom);
  if (!f.include) return all.map((o) => o.label);
  const wanted = new Set(f.include);
  return all.filter((o) => wanted.has(o.value)).map((o) => o.label);
}

/** A stored field resolved for rendering — options filled in from the shared list. */
export function resolveField(f: StoredField): RegistrationField {
  return {
    key: f.key,
    label: f.label,
    kind: f.kind,
    options: f.optionsFrom ? resolvedOptionsFor(f) : f.options,
    required: f.required,
  };
}

export function resolveAll(fields: StoredField[]): RegistrationField[] {
  return fields.map(resolveField);
}

// ── Validation ───────────────────────────────────────────────────────────────

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const NEEDS_OPTIONS: FieldKind[] = ["select", "chips"];

/**
 * Everything wrong with a draft, in the order a person would fix it. Empty
 * means safe to save.
 */
export function validateFieldSet(set: FieldSet): string[] {
  const errors: string[] = [];

  if (!set.roles.length) errors.push("At least one attendee type is required.");

  const groups: [string, StoredField[]][] = [
    ["Everyone", set.common],
    ...set.roles.map((r) => [r.label, set.byType[r.key] ?? []] as [string, StoredField[]]),
  ];

  for (const [groupLabel, fields] of groups) {
    const seen = new Set<string>();
    for (const f of fields) {
      const where = `${groupLabel} · ${f.label || f.key || "(unnamed)"}`;

      if (!f.label?.trim()) errors.push(`${where}: a label is required.`);
      if (!f.key?.trim()) {
        errors.push(`${where}: a key is required.`);
      } else if (!KEY_RE.test(f.key)) {
        errors.push(`${where}: key "${f.key}" must start with a letter and use only letters, numbers and underscores.`);
      } else if (seen.has(f.key)) {
        // Two fields sharing a key would overwrite each other's answers.
        errors.push(`${where}: key "${f.key}" is used twice in this group.`);
      }
      seen.add(f.key);

      if (NEEDS_OPTIONS.includes(f.kind)) {
        // Counts what the field would actually render, so switching every
        // linked option off is caught here rather than by an empty form.
        if (resolvedOptionsFor(f).length === 0) {
          errors.push(`${where}: a ${f.kind} field needs at least one option.`);
        }
      }

      // A single yes/no can't sensibly be mandatory, and the forms never
      // enforced it — saying "required" here would be a lie.
      if (f.kind === "checkbox" && f.required) {
        errors.push(`${where}: a checkbox can't be required.`);
      }
    }
  }

  return errors;
}

// ── Key safety ───────────────────────────────────────────────────────────────

export type KeyUsage = Record<string, number>;

/**
 * Whether a key can still be renamed. Answers are stored in
 * `registrations.answers` keyed by this name, so renaming one that has been
 * answered strands every previous answer — present in the database, invisible
 * in the UI, missing from exports.
 */
export function keyIsLocked(key: string, usage: KeyUsage): boolean {
  return (usage[key] ?? 0) > 0;
}

export type FieldChange =
  | { kind: "added"; group: string; label: string }
  | { kind: "removed"; group: string; label: string; answered: number }
  | { kind: "renamed-key"; group: string; from: string; to: string; answered: number }
  | { kind: "changed"; group: string; label: string; what: string };

/**
 * What a draft changes against the active set, in plain words — the "what
 * changed" list on the save dialog, and the thing that makes a destructive
 * rename visible before it happens rather than after.
 */
export function diffFieldSets(before: FieldSet, after: FieldSet, usage: KeyUsage = {}): FieldChange[] {
  const out: FieldChange[] = [];
  const groups = ["common", ...new Set([...before.roles, ...after.roles].map((r) => r.key))];

  for (const g of groups) {
    const label = g === "common"
      ? "Everyone"
      : after.roles.find((r) => r.key === g)?.label ?? before.roles.find((r) => r.key === g)?.label ?? g;
    const a = g === "common" ? before.common : before.byType[g] ?? [];
    const b = g === "common" ? after.common : after.byType[g] ?? [];

    const aByKey = new Map(a.map((f) => [f.key, f]));
    const bByKey = new Map(b.map((f) => [f.key, f]));

    for (const f of b) {
      const prev = aByKey.get(f.key);
      if (!prev) {
        out.push({ kind: "added", group: label, label: f.label });
        continue;
      }
      if (prev.label !== f.label) {
        out.push({ kind: "changed", group: label, label: f.label, what: `renamed from "${prev.label}"` });
      }
      if (prev.kind !== f.kind) {
        out.push({ kind: "changed", group: label, label: f.label, what: `${prev.kind} → ${f.kind}` });
      }
      if (Boolean(prev.required) !== Boolean(f.required)) {
        out.push({ kind: "changed", group: label, label: f.label, what: f.required ? "now required" : "now optional" });
      }
      // Compares what the field renders, so narrowing a linked list shows up
      // as an option change the same way editing a copied list does.
      const pOpts = resolvedOptionsFor(prev);
      const nOpts = resolvedOptionsFor(f);
      if (pOpts.join("|") !== nOpts.join("|")) {
        const dropped = pOpts.filter((o) => !nOpts.includes(o));
        out.push({
          kind: "changed",
          group: label,
          label: f.label,
          what: dropped.length
            ? `options changed — no longer offers ${dropped.join(", ")}`
            : "options changed",
        });
      }
    }

    for (const f of a) {
      if (!bByKey.has(f.key)) {
        out.push({ kind: "removed", group: label, label: f.label, answered: usage[f.key] ?? 0 });
      }
    }
  }

  return out;
}

/** The code constants as a FieldSet — the fallback, and the seed. */
export function codeDefaultFieldSet(
  roles: RegistrationRole[],
  common: RegistrationField[],
  byType: Record<string, RegistrationField[]>,
): FieldSet {
  const toStored = (f: RegistrationField): StoredField => ({
    key: f.key,
    label: f.label,
    kind: f.kind,
    options: f.options,
    required: f.required,
  });
  return {
    version: "reg-fields-code",
    roles,
    common: common.map(toStored),
    byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.map(toStored)])),
  };
}
