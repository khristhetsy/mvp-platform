// Sales pipelines + stages — standalone. Loose client (sales_* not in gen types).
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type Stage = { id: string; pipeline_id: string; name: string; sort_order: number; is_won: boolean };
export type Pipeline = { id: string; name: string; is_default: boolean; stages: Stage[] };
export type BoardOpp = { id: string; title: string; value_cents: number | null; billing: "yearly" | "monthly"; probability: number | null; priority: number; stage_id: string | null; pipeline_id: string | null; contact_name: string | null; updated_at: string | null };

export async function listPipelines(): Promise<Pipeline[]> {
  const { data: ps } = await db().from("sales_pipelines").select("id, name, is_default").eq("archived", false).order("created_at", { ascending: true });
  const { data: st } = await db().from("sales_stages").select("id, pipeline_id, name, sort_order, is_won").order("sort_order", { ascending: true });
  const stages = (st ?? []) as Stage[];
  return ((ps ?? []) as Array<{ id: string; name: string; is_default: boolean }>).map((p) => ({
    id: String(p.id), name: p.name, is_default: Boolean(p.is_default), stages: stages.filter((s) => s.pipeline_id === p.id),
  }));
}

export async function listBoardOpportunities(): Promise<BoardOpp[]> {
  const { data } = await db().from("sales_opportunities").select("id, title, value_cents, billing, probability, priority, stage_id, pipeline_id, contact_name, updated_at").eq("status", "open");
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id), title: String(r.title), value_cents: (r.value_cents as number) ?? null,
    billing: (r.billing as "yearly" | "monthly") ?? "yearly", probability: (r.probability as number) ?? null, priority: (r.priority as number) ?? 0,
    stage_id: (r.stage_id as string) ?? null, pipeline_id: (r.pipeline_id as string) ?? null, contact_name: (r.contact_name as string) ?? null, updated_at: (r.updated_at as string) ?? null,
  }));
}

export async function createPipeline(name: string): Promise<string | null> {
  const { data, error } = await db().from("sales_pipelines").insert({ name: name.trim() }).select("id").single();
  if (error || !data) return null;
  await db().from("sales_stages").insert([
    { pipeline_id: data.id, name: "New lead", sort_order: 0, is_won: false },
    { pipeline_id: data.id, name: "Won", sort_order: 1, is_won: true },
  ]);
  return String(data.id);
}

export async function updatePipeline(id: string, patch: { name?: string; archived?: boolean }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.archived !== undefined) update.archived = patch.archived;
  const { error } = await db().from("sales_pipelines").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createStage(pipelineId: string, name: string): Promise<void> {
  const { data } = await db().from("sales_stages").select("sort_order").eq("pipeline_id", pipelineId).order("sort_order", { ascending: false }).limit(1);
  const nextSort = ((data ?? [])[0]?.sort_order ?? -1) + 1;
  const { error } = await db().from("sales_stages").insert({ pipeline_id: pipelineId, name: name.trim(), sort_order: nextSort });
  if (error) throw new Error(error.message);
}

export async function updateStage(id: string, patch: { name?: string; sortOrder?: number; isWon?: boolean }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isWon !== undefined) update.is_won = patch.isWon;
  const { error } = await db().from("sales_stages").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteStage(id: string): Promise<void> {
  const { error } = await db().from("sales_stages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
