// Data access for term sheets and the saved Round structure. These tables are not in the generated
// types yet, so a local raw() cast is used (same as business plans).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { LinkedField, RoundStructureInputs, TermSheet, TermSheetFormType, TermSheetSource, TermSheetValues } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

function mapSheet(r: Row): TermSheet {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    formType: r.form_type as TermSheetFormType,
    source: (r.source as TermSheetSource) ?? "scratch",
    status: (r.status as TermSheet["status"]) ?? "draft",
    title: (r.title as string) ?? "",
    values: (r.values as TermSheetValues) ?? {},
    linkedFields: (r.linked_fields as Record<string, LinkedField>) ?? {},
    documentId: (r.document_id as string | null) ?? null,
    noticeAcknowledgedAt: (r.notice_acknowledged_at as string | null) ?? null,
    roundStructureSyncedAt: (r.round_structure_synced_at as string | null) ?? null,
    createdAt: (r.created_at as string | null) ?? null,
    updatedAt: (r.updated_at as string | null) ?? null,
    finalizedAt: (r.finalized_at as string | null) ?? null,
  };
}

export async function listTermSheets(supabase: SupabaseClient<Database>, companyId: string): Promise<TermSheet[]> {
  const { data, error } = await raw(supabase).from("term_sheets").select("*").eq("company_id", companyId).order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(mapSheet);
}

export async function getTermSheet(supabase: SupabaseClient<Database>, companyId: string, id: string): Promise<TermSheet | null> {
  const { data, error } = await raw(supabase).from("term_sheets").select("*").eq("company_id", companyId).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSheet(data as Row) : null;
}

export interface TermSheetCreate {
  formType: TermSheetFormType;
  source: TermSheetSource;
  title: string;
  values: TermSheetValues;
  linkedFields: Record<string, LinkedField>;
  roundStructure?: RoundStructureInputs | null;
}

export async function createTermSheet(
  supabase: SupabaseClient<Database>,
  companyId: string,
  editorId: string,
  input: TermSheetCreate,
): Promise<TermSheet> {
  const record: Record<string, unknown> = {
    company_id: companyId,
    form_type: input.formType,
    source: input.source,
    title: input.title,
    values: input.values,
    linked_fields: input.linkedFields,
    last_edited_by: editorId,
  };
  if (input.roundStructure) {
    record.round_structure_snapshot = input.roundStructure;
    record.round_structure_synced_at = new Date().toISOString();
  }
  const { data, error } = await raw(supabase).from("term_sheets").insert(record).select("*").single();
  if (error) throw new Error(error.message);
  return mapSheet(data as Row);
}

export interface TermSheetPatch {
  title?: string;
  values?: TermSheetValues;
  linkedFields?: Record<string, LinkedField>;
  status?: TermSheet["status"];
  documentId?: string | null;
  noticeAcknowledged?: boolean;
  roundStructure?: RoundStructureInputs | null;
}

export async function updateTermSheet(
  supabase: SupabaseClient<Database>,
  companyId: string,
  id: string,
  editorId: string,
  patch: TermSheetPatch,
): Promise<TermSheet | null> {
  const record: Record<string, unknown> = { last_edited_by: editorId };
  if (patch.title !== undefined) record.title = patch.title;
  if (patch.values !== undefined) record.values = patch.values;
  if (patch.linkedFields !== undefined) record.linked_fields = patch.linkedFields;
  if (patch.documentId !== undefined) record.document_id = patch.documentId;
  if (patch.noticeAcknowledged) record.notice_acknowledged_at = new Date().toISOString();
  if (patch.roundStructure) {
    record.round_structure_snapshot = patch.roundStructure;
    record.round_structure_synced_at = new Date().toISOString();
  }
  if (patch.status !== undefined) {
    record.status = patch.status;
    if (patch.status === "finalized") record.finalized_at = new Date().toISOString();
  }
  const { data, error } = await raw(supabase).from("term_sheets").update(record).eq("company_id", companyId).eq("id", id).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSheet(data as Row) : null;
}

export async function deleteTermSheet(supabase: SupabaseClient<Database>, companyId: string, id: string): Promise<void> {
  const { error } = await raw(supabase).from("term_sheets").delete().eq("company_id", companyId).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Round structure (saved calculator inputs) ───────────────────────────────

export interface SavedRoundStructure {
  inputs: RoundStructureInputs;
  updatedAt: string | null;
}

function cleanInputs(i: Partial<RoundStructureInputs>): RoundStructureInputs {
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
  return {
    roundType: i.roundType === "note" || i.roundType === "priced" ? i.roundType : "safe",
    safeType: i.safeType === "pre_money" ? "pre_money" : "post_money",
    preMoney: n(i.preMoney, 0),
    raiseAmount: n(i.raiseAmount, 0),
    optionPoolPct: n(i.optionPoolPct, 0),
    discountPct: n(i.discountPct, 0),
    interestPct: n(i.interestPct, 0),
    maturityMonths: n(i.maturityMonths, 0),
    warrantPct: n(i.warrantPct, 0),
  };
}

export async function getRoundStructure(supabase: SupabaseClient<Database>, companyId: string): Promise<SavedRoundStructure | null> {
  const { data, error } = await raw(supabase).from("round_structures").select("inputs, updated_at").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { inputs: cleanInputs((data as Row).inputs as Partial<RoundStructureInputs>), updatedAt: ((data as Row).updated_at as string | null) ?? null };
}

export async function saveRoundStructure(
  supabase: SupabaseClient<Database>,
  companyId: string,
  editorId: string,
  inputs: Partial<RoundStructureInputs>,
): Promise<SavedRoundStructure> {
  const clean = cleanInputs(inputs);
  const { data, error } = await raw(supabase)
    .from("round_structures")
    .upsert({ company_id: companyId, inputs: clean, updated_by: editorId }, { onConflict: "company_id" })
    .select("inputs, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return { inputs: clean, updatedAt: ((data as Row).updated_at as string | null) ?? null };
}
