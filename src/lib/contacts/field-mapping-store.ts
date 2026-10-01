/**
 * Server-side store for contact import field mappings: saved decisions per source and
 * column (contact_field_mappings) and custom text fields (contact_custom_fields).
 * Service role only; both tables have RLS on with no policies.
 */
import "server-only";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { reportDbError } from "@/lib/supabase/report";
import { customKeyOf, TARGET_KEYS, type ColumnMapping, type CustomField, type MappingSource, type SavedMapping } from "./field-mapping";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export type SavedMappingRow = SavedMapping & { source: MappingSource; updated_at: string };

export async function loadSavedMappings(source?: MappingSource): Promise<SavedMappingRow[]> {
  let q = db().from("contact_field_mappings").select("source, source_column, action, target_field, custom_key, updated_at");
  if (source) q = q.eq("source", source);
  const { data, error } = await q.order("source_column", { ascending: true }).limit(2000);
  if (reportDbError("field mappings load", error)) return [];
  return (data ?? []) as SavedMappingRow[];
}

export async function loadCustomFields(): Promise<CustomField[]> {
  const { data, error } = await db().from("contact_custom_fields").select("key, label").order("label", { ascending: true }).limit(1000);
  if (reportDbError("custom fields load", error)) return [];
  return (data ?? []) as CustomField[];
}

/**
 * Create any custom field named in the mapping that doesn't exist yet, and return the
 * mapping with every custom entry pointing at a key. An existing field with the same
 * key is reused, so typing the same name twice never makes two fields.
 */
export async function ensureCustomFields(mapping: ColumnMapping[], userId: string | null): Promise<{ mapping: ColumnMapping[]; labels: Record<string, string> }> {
  const existing = await loadCustomFields();
  const labels: Record<string, string> = Object.fromEntries(existing.map((f) => [f.key, f.label]));
  const toCreate: CustomField[] = [];
  const out = mapping.map((m) => {
    if (m.action !== "custom") return m;
    if (m.customKey && labels[m.customKey]) return { ...m, customLabel: null };
    const label = (m.customLabel ?? "").trim().slice(0, 120);
    const key = customKeyOf(label);
    if (!labels[key]) { labels[key] = label; toCreate.push({ key, label }); }
    return { ...m, customKey: key, customLabel: null };
  });
  if (toCreate.length) {
    const { error } = await db().from("contact_custom_fields").upsert(toCreate.map((f) => ({ ...f, created_by: userId })), { onConflict: "key", ignoreDuplicates: true });
    if (error) throw new Error("Couldn't create the custom field.");
  }
  return { mapping: out, labels };
}

/** Save decisions for a source (one row per column). Columns left "none" are not saved. */
export async function saveMappings(source: MappingSource, mapping: ColumnMapping[], userId: string | null): Promise<number> {
  const rows = mapping
    .filter((m) => m.action === "ignore" || (m.action === "map" && m.target && TARGET_KEYS.includes(m.target)) || (m.action === "custom" && m.customKey))
    .map((m) => ({
      source,
      source_column: m.column.slice(0, 200),
      action: m.action,
      target_field: m.action === "map" ? m.target : null,
      custom_key: m.action === "custom" ? m.customKey : null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return 0;
  const { error } = await db().from("contact_field_mappings").upsert(rows, { onConflict: "source,source_column" });
  if (error) throw new Error("Couldn't save the mappings.");
  return rows.length;
}

export async function deleteMapping(source: MappingSource, column: string): Promise<void> {
  const { error } = await db().from("contact_field_mappings").delete().eq("source", source).eq("source_column", column);
  if (error) throw new Error("Couldn't remove the mapping.");
}
