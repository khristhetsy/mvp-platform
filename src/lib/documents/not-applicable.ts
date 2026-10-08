import type { SupabaseClient } from "@supabase/supabase-js";

export { NA_ALLOWED_TYPES, normalizeNaType } from "./na-shared";
import { NA_ALLOWED_TYPES, normalizeNaType, type NaEntry } from "./na-shared";

/** Load the set of document types marked Not-applicable for a company (canonical codes). */
export async function loadNotApplicableTypes(
  admin: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const { data } = await admin
    .from("document_not_applicable")
    .select("document_type")
    .eq("company_id", companyId);
  return (data ?? []).map((r: { document_type: string }) => normalizeNaType(r.document_type));
}

/** N/A markers with their note, time and who marked them (name), keyed by canonical code. */
export async function loadNotApplicableEntries(
  admin: SupabaseClient,
  companyId: string,
): Promise<Record<string, NaEntry>> {
  const { data } = await admin
    .from("document_not_applicable")
    .select("document_type, reason, marked_by, created_at")
    .eq("company_id", companyId);
  const rows = (data ?? []) as Array<{ document_type: string; reason: string | null; marked_by: string | null; created_at: string | null }>;
  const ids = [...new Set(rows.map((r) => r.marked_by).filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await admin.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (people ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      names.set(p.id, p.full_name || p.email || "");
    }
  }
  const out: Record<string, NaEntry> = {};
  for (const r of rows) {
    const code = normalizeNaType(r.document_type);
    out[code] = {
      documentType: code,
      note: r.reason?.trim() || null,
      markedAt: r.created_at,
      markedByName: (r.marked_by && names.get(r.marked_by)) || null,
    };
  }
  return out;
}

/** Insert or remove a Not-applicable marker. Caller must have verified ownership. */
export async function setNotApplicable(
  admin: SupabaseClient,
  input: { companyId: string; documentType: string; markedBy: string; notApplicable: boolean; reason?: string | null },
): Promise<{ error: string | null }> {
  const type = normalizeNaType(input.documentType);
  if (!NA_ALLOWED_TYPES.has(type)) {
    return { error: "This document type cannot be marked not applicable." };
  }

  if (input.notApplicable) {
    const { error } = await admin
      .from("document_not_applicable")
      .upsert(
        { company_id: input.companyId, document_type: type, marked_by: input.markedBy, reason: input.reason ?? null },
        { onConflict: "company_id,document_type" },
      );
    return { error: error?.message ?? null };
  }

  const { error } = await admin
    .from("document_not_applicable")
    .delete()
    .eq("company_id", input.companyId)
    .eq("document_type", type);
  return { error: error?.message ?? null };
}

/** N/A codes for many companies at once (batch passes: reminders, admin tracker). */
export async function loadNotApplicableByCompany(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!companyIds.length) return out;
  const { data } = await admin
    .from("document_not_applicable")
    .select("company_id, document_type")
    .in("company_id", companyIds);
  for (const r of (data ?? []) as Array<{ company_id: string; document_type: string }>) {
    const arr = out.get(r.company_id) ?? [];
    arr.push(normalizeNaType(r.document_type));
    out.set(r.company_id, arr);
  }
  return out;
}
