// Sales pipelines + stages — standalone. Loose client (sales_* not in gen types).
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type Stage = { id: string; pipeline_id: string; name: string; sort_order: number; is_won: boolean; sequence_id: string | null };
export type Pipeline = { id: string; name: string; is_default: boolean; stages: Stage[] };
export type BoardOpp = { id: string; title: string; value_cents: number | null; billing: "yearly" | "monthly"; probability: number | null; priority: number; stage_id: string | null; pipeline_id: string | null; contact_name: string | null; updated_at: string | null };

export async function listPipelines(): Promise<Pipeline[]> {
  const { data: ps } = await db().from("sales_pipelines").select("id, name, is_default").eq("archived", false).order("created_at", { ascending: true });
  const { data: st } = await db().from("sales_stages").select("id, pipeline_id, name, sort_order, is_won, sequence_id").order("sort_order", { ascending: true });
  const stages = (st ?? []) as Stage[];
  return ((ps ?? []) as Array<{ id: string; name: string; is_default: boolean }>).map((p) => ({
    id: String(p.id), name: p.name, is_default: Boolean(p.is_default), stages: stages.filter((s) => s.pipeline_id === p.id),
  }));
}

export async function listBoardOpportunities(ownerId?: string | null): Promise<BoardOpp[]> {
  let query = db().from("sales_opportunities").select("id, title, value_cents, billing, probability, priority, stage_id, pipeline_id, contact_name, updated_at").eq("status", "open");
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data } = await query;
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

export async function updateStage(id: string, patch: { name?: string; sortOrder?: number; isWon?: boolean; sequenceId?: string | null }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isWon !== undefined) update.is_won = patch.isWon;
  if (patch.sequenceId !== undefined) update.sequence_id = patch.sequenceId;
  const { error } = await db().from("sales_stages").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Delete a stage, with guardrails:
 *  - a pipeline must keep at least one stage;
 *  - a pipeline must keep at least one "Won" stage (so deals can still close).
 * Opportunities in the deleted stage are moved to `reassignToStageId` when given
 * (must be a sibling in the same pipeline), otherwise left unstaged.
 */
export async function deleteStage(id: string, reassignToStageId?: string | null): Promise<void> {
  const client = db();
  const { data: stage, error: sErr } = await client
    .from("sales_stages").select("id, pipeline_id, is_won").eq("id", id).single();
  if (sErr || !stage) throw new Error("Stage not found.");

  const { data: siblings, error: liErr } = await client
    .from("sales_stages").select("id, is_won").eq("pipeline_id", stage.pipeline_id);
  if (liErr) throw new Error(liErr.message);
  const all = (siblings ?? []) as Array<{ id: string; is_won: boolean }>;
  if (all.length <= 1) throw new Error("A pipeline needs at least one stage.");
  if (stage.is_won && all.filter((s) => s.is_won).length <= 1) {
    throw new Error("Keep at least one Won stage so deals can still be marked won.");
  }

  if (reassignToStageId) {
    if (reassignToStageId === id) throw new Error("Choose a different stage to move deals to.");
    if (!all.some((s) => s.id === reassignToStageId)) throw new Error("Move deals to a stage in the same pipeline.");
    const { error: mErr } = await client
      .from("sales_opportunities").update({ stage_id: reassignToStageId }).eq("stage_id", id);
    if (mErr) throw new Error(mErr.message);
  }

  const { error } = await client.from("sales_stages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
