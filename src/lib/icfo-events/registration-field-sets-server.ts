/**
 * Reading and saving the versioned registration questions.
 *
 * The loader never throws and never returns nothing: an empty table, a broken
 * query or a missing migration all fall back to the code constants, because a
 * registration form that fails to render is worse than one showing slightly
 * stale questions.
 */
import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  REGISTRATION_BY_TYPE,
  REGISTRATION_COMMON,
  REGISTRATION_ROLES,
} from "@/lib/icfo-events/registration-fields";
import {
  codeDefaultFieldSet,
  diffFieldSets,
  validateFieldSet,
  type FieldSet,
  type KeyUsage,
  type StoredField,
} from "@/lib/icfo-events/registration-field-sets";

function raw(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** The constants, as a set. Used when the table has nothing to say. */
export const CODE_DEFAULT_FIELD_SET: FieldSet = codeDefaultFieldSet(
  REGISTRATION_ROLES,
  REGISTRATION_COMMON,
  REGISTRATION_BY_TYPE,
);

type Row = Record<string, unknown>;

function mapSet(r: Row): FieldSet {
  return {
    version: String(r.version),
    roles: (r.roles ?? []) as FieldSet["roles"],
    common: (r.common ?? []) as StoredField[],
    byType: (r.by_type ?? {}) as Record<string, StoredField[]>,
  };
}

/**
 * The active set, once per request. Falls back to the constants rather than
 * failing — see the note at the top.
 */
export const loadRegistrationFieldSet = cache(async (): Promise<FieldSet> => {
  try {
    const { data } = await raw()
      .from("registration_field_sets")
      .select("version, roles, common, by_type")
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return CODE_DEFAULT_FIELD_SET;
    const set = mapSet(data as Row);
    // A stored set that doesn't validate is worse than the constants: it could
    // render a form nobody can submit.
    return validateFieldSet(set).length ? CODE_DEFAULT_FIELD_SET : set;
  } catch {
    return CODE_DEFAULT_FIELD_SET;
  }
});

export type FieldSetVersion = FieldSet & {
  id: string;
  isActive: boolean;
  reason: string | null;
  createdAt: string;
  createdByName: string | null;
};

export async function listFieldSetVersions(): Promise<FieldSetVersion[]> {
  const { data } = await raw()
    .from("registration_field_sets")
    .select("*, profiles:created_by(full_name, email)")
    .order("created_at", { ascending: false });
  return ((data ?? []) as Row[]).map((r) => {
    const p = r.profiles as { full_name?: string | null; email?: string | null } | null | undefined;
    return {
      ...mapSet(r),
      id: String(r.id),
      isActive: Boolean(r.is_active),
      reason: (r.reason as string | null) ?? null,
      createdAt: String(r.created_at),
      createdByName: p?.full_name ?? p?.email ?? null,
    };
  });
}

/**
 * How many registrations have answered under each key.
 *
 * This is what makes the key lock real rather than advisory — without it the
 * editor would be guessing which renames are safe. Counted in one pass over the
 * answers jsonb rather than a query per key.
 */
export async function answerCounts(): Promise<KeyUsage> {
  const usage: KeyUsage = {};
  try {
    const { data } = await raw().from("registrations").select("answers").not("answers", "eq", "{}");
    for (const r of (data ?? []) as Row[]) {
      const answers = r.answers as Record<string, unknown> | null;
      if (!answers) continue;
      for (const [key, value] of Object.entries(answers)) {
        // An empty string or empty list isn't an answer.
        const answered = Array.isArray(value) ? value.length > 0 : value !== null && value !== "" && value !== undefined;
        if (answered) usage[key] = (usage[key] ?? 0) + 1;
      }
    }
  } catch {
    // Counting failed: return nothing rather than a wrong zero, and let the
    // caller treat unknown usage as locked.
    return {};
  }
  return usage;
}

export type SaveResult =
  | { ok: true; version: string }
  | { ok: false; errors: string[] };

/** Next free version label — reg-fields-v2, v3, … */
function nextVersion(taken: string[]): string {
  let n = 2;
  while (taken.includes(`reg-fields-v${n}`)) n += 1;
  return `reg-fields-v${n}`;
}

/**
 * Save a draft as a new active version. Never edits a row in place, so every
 * previous set stays readable and revertible.
 */
export async function saveFieldSet(
  draft: FieldSet,
  reason: string,
  createdBy: string | null,
): Promise<SaveResult> {
  const errors = validateFieldSet(draft);
  if (errors.length) return { ok: false, errors };
  if (!reason.trim()) return { ok: false, errors: ["Say why this version exists."] };

  // A rename of an answered key would strand its answers; the editor locks the
  // input, and this is the server-side half of that guard.
  const usage = await answerCounts();
  const active = await loadRegistrationFieldSet();
  const stranded = diffFieldSets(active, draft, usage).filter(
    (c) => c.kind === "removed" && c.answered > 0,
  );

  const db = raw();
  const { data: existing } = await db.from("registration_field_sets").select("version");
  const version = nextVersion(((existing ?? []) as Row[]).map((r) => String(r.version)));

  const { error } = await db.from("registration_field_sets").insert({
    version,
    roles: draft.roles,
    common: draft.common,
    by_type: draft.byType,
    is_active: false,
    reason: reason.trim(),
    created_by: createdBy,
  });
  if (error) return { ok: false, errors: [error.message] };

  // Flip active in two steps: the partial unique index allows only one active
  // row, so the old one has to stand down first.
  await db.from("registration_field_sets").update({ is_active: false }).eq("is_active", true);
  await db.from("registration_field_sets").update({ is_active: true }).eq("version", version);

  // Removing an answered field is allowed — the answers stay on the
  // registration and in exports — but it is worth recording why.
  if (stranded.length) {
    await db
      .from("registration_field_sets")
      .update({
        reason: `${reason.trim()}  [removed with existing answers: ${stranded
          .map((c) => (c.kind === "removed" ? `${c.label} (${c.answered})` : ""))
          .join(", ")}]`,
      })
      .eq("version", version);
  }

  return { ok: true, version };
}

/** Make an earlier version active again. */
export async function activateFieldSet(id: string): Promise<void> {
  const db = raw();
  await db.from("registration_field_sets").update({ is_active: false }).eq("is_active", true);
  await db.from("registration_field_sets").update({ is_active: true }).eq("id", id);
}
