// Data-room Q&A: investors ask, founders answer. Company-scoped.
// Reads/writes go through the service-role client with explicit company/investor
// filters (mirroring data-room activity + access); callers must authorize first.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export interface DataRoomQuestion {
  id: string;
  companyId: string;
  investorId: string;
  investorName: string | null;
  documentId: string | null;
  documentLabel: string | null;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
}

type Row = Record<string, unknown>;

function loose(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

function titleCase(code: string): string {
  return code.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

async function decorate(rows: Row[]): Promise<DataRoomQuestion[]> {
  if (rows.length === 0) return [];
  const admin = loose();

  const investorIds = [...new Set(rows.map((r) => String(r.investor_id)))];
  const docIds = [...new Set(rows.map((r) => r.document_id).filter(Boolean) as string[])];

  const [{ data: profs }, docsRes] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").in("id", investorIds),
    docIds.length
      ? admin.from("documents").select("id, file_name, document_type").in("id", docIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);
  const profMap = new Map((profs ?? []).map((p: Row) => [String(p.id), p]));
  const docMap = new Map(
    (docsRes.data ?? []).map((d: Row) => [
      String(d.id),
      (d.file_name as string) || (d.document_type ? titleCase(String(d.document_type)) : "Document"),
    ]),
  );

  return rows.map((r) => {
    const prof = profMap.get(String(r.investor_id)) as Row | undefined;
    return {
      id: String(r.id),
      companyId: String(r.company_id),
      investorId: String(r.investor_id),
      investorName: (prof?.full_name as string) || (prof?.email as string) || null,
      documentId: (r.document_id as string | null) ?? null,
      documentLabel: r.document_id ? docMap.get(String(r.document_id)) ?? null : null,
      question: String(r.question),
      answer: (r.answer as string | null) ?? null,
      answeredAt: (r.answered_at as string | null) ?? null,
      createdAt: String(r.created_at),
    };
  });
}

/** Founder view: every question on their company's data room, newest first. */
export async function listCompanyQuestions(companyId: string): Promise<DataRoomQuestion[]> {
  const { data } = await loose()
    .from("data_room_questions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return decorate((data ?? []) as Row[]);
}

/** Investor view: only the questions this investor asked, newest first. */
export async function listInvestorQuestions(companyId: string, investorId: string): Promise<DataRoomQuestion[]> {
  const { data } = await loose()
    .from("data_room_questions")
    .select("*")
    .eq("company_id", companyId)
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });
  return decorate((data ?? []) as Row[]);
}

export async function createQuestion(input: {
  companyId: string;
  investorId: string;
  documentId?: string | null;
  question: string;
}): Promise<void> {
  const { error } = await loose()
    .from("data_room_questions")
    .insert({
      company_id: input.companyId,
      investor_id: input.investorId,
      document_id: input.documentId ?? null,
      question: input.question,
    });
  if (error) throw new Error(`Could not submit question: ${error.message}`);
}

/** Answer a question — guarded by companyId so a founder can only answer their own. */
export async function answerQuestion(input: {
  questionId: string;
  companyId: string;
  answeredBy: string;
  answer: string;
}): Promise<boolean> {
  const { data, error } = await loose()
    .from("data_room_questions")
    .update({
      answer: input.answer,
      answered_by: input.answeredBy,
      answered_at: new Date().toISOString(),
    })
    .eq("id", input.questionId)
    .eq("company_id", input.companyId)
    .select("id");
  if (error) throw new Error(`Could not save answer: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Resolve the owning company for a question (for founder-side authorization). */
export async function getQuestionCompanyId(questionId: string): Promise<string | null> {
  const { data } = await loose()
    .from("data_room_questions")
    .select("company_id")
    .eq("id", questionId)
    .maybeSingle();
  return (data as { company_id?: string } | null)?.company_id ?? null;
}
