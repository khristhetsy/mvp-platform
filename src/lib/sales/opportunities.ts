// Sales opportunities — standalone (no Odoo). Keyed loosely to a CRM contact.
import { createServiceRoleClient } from "@/lib/supabase/admin";

// sales_* tables aren't in the generated Supabase types — use a loose client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type Stage = { id: string; name: string; sort_order: number; is_won: boolean };
export type Opportunity = {
  id: string; title: string; contact_name: string | null; contact_email: string | null;
  stage_id: string | null; stage_name: string | null; value_cents: number | null;
  status: "open" | "won" | "lost" | "archived"; notes: string | null; created_at: string;
};

export async function getDefaultPipeline(): Promise<{ id: string; stages: Stage[] } | null> {
  const { data: p } = await db().from("sales_pipelines").select("id").eq("is_default", true).eq("archived", false).order("created_at").limit(1).maybeSingle();
  if (!p) return null;
  const { data: s } = await db().from("sales_stages").select("id, name, sort_order, is_won").eq("pipeline_id", p.id).order("sort_order", { ascending: true });
  return { id: String(p.id), stages: (s ?? []) as Stage[] };
}

export async function listOpportunities(includeArchived = false): Promise<Opportunity[]> {
  let q = db()
    .from("sales_opportunities")
    .select("id, title, contact_name, contact_email, stage_id, value_cents, status, notes, created_at, stage:sales_stages(name)")
    .order("created_at", { ascending: false });
  if (!includeArchived) q = q.neq("status", "archived");
  const { data } = await q;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    contact_name: (r.contact_name as string) ?? null,
    contact_email: (r.contact_email as string) ?? null,
    stage_id: (r.stage_id as string) ?? null,
    stage_name: ((r.stage as { name?: string } | null)?.name) ?? null,
    value_cents: (r.value_cents as number) ?? null,
    status: (r.status as Opportunity["status"]) ?? "open",
    notes: (r.notes as string) ?? null,
    created_at: String(r.created_at),
  }));
}

export async function createOpportunity(input: { name: string; email?: string | null; company?: string | null; createdBy?: string | null }): Promise<Opportunity | null> {
  const pipeline = await getDefaultPipeline();
  const firstStage = pipeline?.stages[0]?.id ?? null;
  const title = input.company ? `${input.name} · ${input.company}` : input.name;
  const { data, error } = await db()
    .from("sales_opportunities")
    .insert({ title, contact_name: input.name, contact_email: input.email || null, pipeline_id: pipeline?.id ?? null, stage_id: firstStage, status: "open", created_by: input.createdBy || null })
    .select("id")
    .single();
  if (error || !data) return null;
  const list = await listOpportunities(true);
  return list.find((o) => o.id === String(data.id)) ?? null;
}

export async function updateOpportunity(id: string, patch: { title?: string; stageId?: string | null; valueCents?: number | null; status?: Opportunity["status"]; notes?: string | null }): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.stageId !== undefined) update.stage_id = patch.stageId || null;
  if (patch.valueCents !== undefined) update.value_cents = patch.valueCents;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.notes !== undefined) update.notes = patch.notes;
  const { error } = await db().from("sales_opportunities").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteOpportunity(id: string): Promise<void> {
  const { error } = await db().from("sales_opportunities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
