import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Document types a founder is allowed to mark "Not applicable".
 * Stored in canonical (normalized) form. Critical docs (pitch deck, financials,
 * cap table) are intentionally excluded so the readiness signal can't be gamed.
 */
export const NA_ALLOWED_TYPES = new Set(["CUSTOMER_CONTRACTS", "LEGAL_DOCUMENTS", "OTHER"]);

/** Normalize a UI document-type value to the canonical code stored everywhere. */
export function normalizeNaType(input: string): string {
  const value = input.toUpperCase().trim();
  if (value === "LEGAL_DOCUMENT") return "LEGAL_DOCUMENTS";
  return value;
}

/** Load the set of document types marked Not-applicable for a company (canonical codes). */
export async function loadNotApplicableTypes(
  admin: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const { data } = await admin
    .from("document_not_applicable")
    .select("document_type")
    .eq("company_id", companyId);
  return (data ?? []).map((r: { document_type: string }) => r.document_type.toUpperCase());
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
