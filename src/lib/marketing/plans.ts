/**
 * Marketing plan / strategy data layer.
 * Mirrors the campaigns.ts pattern: uses the service-role client from db.ts;
 * access control is enforced at the API layer via requireRole(["admin"]).
 */
import { marketingDb } from "./db";
import type {
  MarketingPlan,
  MarketingPlanItem,
} from "./types";

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function getPlans(): Promise<MarketingPlan[]> {
  const db = marketingDb();
  const { data, error } = await db
    .from("marketing_plans")
    .select("*, items:marketing_plan_items(id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: MarketingPlan & { items?: { id: string }[] }) => ({
    ...p,
    item_count: Array.isArray(p.items) ? p.items.length : 0,
    items: undefined,
  })) as MarketingPlan[];
}

export async function getPlan(id: string): Promise<MarketingPlan | null> {
  const db = marketingDb();
  const { data, error } = await db
    .from("marketing_plans")
    .select("*, items:marketing_plan_items(*)")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw error;
  }
  const plan = data as MarketingPlan;
  if (Array.isArray(plan.items)) {
    plan.items.sort((a, b) => a.sort_order - b.sort_order);
  }
  return plan;
}

export type CreatePlanInput = Partial<
  Pick<
    MarketingPlan,
    | "name"
    | "objective"
    | "summary"
    | "target_audience"
    | "budget"
    | "status"
    | "start_date"
    | "end_date"
    | "generated_by"
  >
> & { name: string };

export async function createPlan(
  input: CreatePlanInput,
  createdBy?: string,
): Promise<MarketingPlan> {
  const db = marketingDb();
  const { data, error } = await db
    .from("marketing_plans")
    .insert({
      name: input.name,
      objective: input.objective ?? null,
      summary: input.summary ?? null,
      target_audience: input.target_audience ?? null,
      budget: input.budget ?? null,
      status: input.status ?? "draft",
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      generated_by: input.generated_by ?? "manual",
      ...(createdBy ? { created_by: createdBy } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return data as MarketingPlan;
}

export type UpdatePlanInput = Partial<
  Pick<
    MarketingPlan,
    | "name"
    | "objective"
    | "summary"
    | "target_audience"
    | "budget"
    | "status"
    | "start_date"
    | "end_date"
  >
>;

export async function updatePlan(
  id: string,
  input: UpdatePlanInput,
): Promise<MarketingPlan> {
  const db = marketingDb();
  const { data, error } = await db
    .from("marketing_plans")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as MarketingPlan;
}

export async function deletePlan(id: string): Promise<void> {
  const db = marketingDb();
  const { error } = await db.from("marketing_plans").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Plan items (initiatives)
// ---------------------------------------------------------------------------

export type CreatePlanItemInput = Partial<
  Pick<
    MarketingPlanItem,
    | "description"
    | "channel"
    | "status"
    | "priority"
    | "start_date"
    | "due_date"
    | "sort_order"
  >
> & { plan_id: string; title: string };

export async function createPlanItem(
  input: CreatePlanItemInput,
): Promise<MarketingPlanItem> {
  const db = marketingDb();
  const { data, error } = await db
    .from("marketing_plan_items")
    .insert({
      plan_id: input.plan_id,
      title: input.title,
      description: input.description ?? null,
      channel: input.channel ?? "other",
      status: input.status ?? "planned",
      priority: input.priority ?? "medium",
      start_date: input.start_date ?? null,
      due_date: input.due_date ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MarketingPlanItem;
}

/** Bulk insert items for a plan (used when accepting an AI CMO draft). */
export async function createPlanItems(
  planId: string,
  items: Array<Omit<CreatePlanItemInput, "plan_id">>,
): Promise<MarketingPlanItem[]> {
  if (items.length === 0) return [];
  const db = marketingDb();
  const rows = items.map((it, i) => ({
    plan_id: planId,
    title: it.title,
    description: it.description ?? null,
    channel: it.channel ?? "other",
    status: it.status ?? "planned",
    priority: it.priority ?? "medium",
    start_date: it.start_date ?? null,
    due_date: it.due_date ?? null,
    sort_order: it.sort_order ?? i,
  }));
  const { data, error } = await db
    .from("marketing_plan_items")
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []) as MarketingPlanItem[];
}

export type UpdatePlanItemInput = Partial<
  Pick<
    MarketingPlanItem,
    | "title"
    | "description"
    | "channel"
    | "status"
    | "priority"
    | "start_date"
    | "due_date"
    | "sort_order"
    | "task_id"
  >
>;

export async function updatePlanItem(
  id: string,
  input: UpdatePlanItemInput,
): Promise<MarketingPlanItem> {
  const db = marketingDb();
  const { data, error } = await db
    .from("marketing_plan_items")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as MarketingPlanItem;
}

export async function deletePlanItem(id: string): Promise<void> {
  const db = marketingDb();
  const { error } = await db.from("marketing_plan_items").delete().eq("id", id);
  if (error) throw error;
}

export async function getPlanItem(
  id: string,
): Promise<MarketingPlanItem | null> {
  const db = marketingDb();
  const { data, error } = await db
    .from("marketing_plan_items")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as MarketingPlanItem;
}
