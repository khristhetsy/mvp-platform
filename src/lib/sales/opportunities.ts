// Sales opportunities — standalone (no Odoo). Keyed loosely to a CRM contact.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/sales/activity";

// sales_* tables aren't in the generated Supabase types — use a loose client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type Stage = { id: string; name: string; sort_order: number; is_won: boolean };
export type Opportunity = {
  id: string; title: string; contact_name: string | null; contact_email: string | null;
  contact_crm_id: string | null;
  stage_id: string | null; stage_name: string | null; value_cents: number | null;
  billing: "yearly" | "monthly"; probability: number | null; expected_close: string | null;
  priority: number; tags: string[]; source: string | null; lead_status: string | null;
  status: "open" | "won" | "lost" | "archived"; notes: string | null;
  created_at: string; updated_at: string | null; last_activity_at: string | null;
};

const SELECT =
  "id, title, contact_name, contact_email, contact_crm_id, stage_id, value_cents, billing, probability, expected_close, priority, tags, source, lead_status, status, notes, created_at, updated_at, last_activity_at, stage:sales_stages(name)";

function mapRow(r: Record<string, unknown>): Opportunity {
  return {
    id: String(r.id),
    title: String(r.title),
    contact_name: (r.contact_name as string) ?? null,
    contact_email: (r.contact_email as string) ?? null,
    contact_crm_id: (r.contact_crm_id as string) ?? null,
    stage_id: (r.stage_id as string) ?? null,
    stage_name: ((r.stage as { name?: string } | null)?.name) ?? null,
    value_cents: (r.value_cents as number) ?? null,
    billing: (r.billing as "yearly" | "monthly") ?? "yearly",
    probability: (r.probability as number) ?? null,
    expected_close: (r.expected_close as string) ?? null,
    priority: (r.priority as number) ?? 0,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    source: (r.source as string) ?? null,
    lead_status: (r.lead_status as string) ?? null,
    status: (r.status as Opportunity["status"]) ?? "open",
    notes: (r.notes as string) ?? null,
    created_at: String(r.created_at),
    updated_at: (r.updated_at as string) ?? null,
    last_activity_at: (r.last_activity_at as string) ?? null,
  };
}

// Expected monthly recurring revenue, derived from value + billing (yearly ÷ 12).
export function monthlyRecurringCents(o: Pick<Opportunity, "value_cents" | "billing">): number | null {
  if (o.value_cents == null) return null;
  return o.billing === "monthly" ? o.value_cents : Math.round(o.value_cents / 12);
}

export async function getDefaultPipeline(): Promise<{ id: string; stages: Stage[] } | null> {
  const { data: p } = await db().from("sales_pipelines").select("id").eq("is_default", true).eq("archived", false).order("created_at").limit(1).maybeSingle();
  if (!p) return null;
  const { data: s } = await db().from("sales_stages").select("id, name, sort_order, is_won").eq("pipeline_id", p.id).order("sort_order", { ascending: true });
  return { id: String(p.id), stages: (s ?? []) as Stage[] };
}

export async function listOpportunities(includeArchived = false): Promise<Opportunity[]> {
  let q = db().from("sales_opportunities").select(SELECT).order("created_at", { ascending: false });
  if (!includeArchived) q = q.neq("status", "archived");
  const { data } = await q;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const { data } = await db().from("sales_opportunities").select(SELECT).eq("id", id).maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export type CreateOpportunityInput = {
  name: string; email?: string | null; company?: string | null; contactCrmId?: string | null;
  valueCents?: number | null; billing?: "yearly" | "monthly"; pipelineId?: string | null; stageId?: string | null;
  probability?: number | null; expectedClose?: string | null; source?: string | null; leadStatus?: string | null;
  createdBy?: string | null;
};

export async function createOpportunity(input: CreateOpportunityInput): Promise<Opportunity | null> {
  const pipeline = input.pipelineId ? { id: input.pipelineId } : await getDefaultPipeline();
  let stageId = input.stageId ?? null;
  if (!stageId) {
    const def = await getDefaultPipeline();
    stageId = def?.stages[0]?.id ?? null;
  }
  const title = input.company ? `${input.name} · ${input.company}` : input.name;
  const { data, error } = await db()
    .from("sales_opportunities")
    .insert({
      title, contact_name: input.name, contact_email: input.email || null, contact_crm_id: input.contactCrmId || null,
      pipeline_id: pipeline?.id ?? null, stage_id: stageId, status: "open",
      value_cents: input.valueCents ?? null, billing: input.billing ?? "yearly",
      probability: input.probability ?? null, expected_close: input.expectedClose || null,
      source: input.source || null, lead_status: input.leadStatus || null,
      created_by: input.createdBy || null,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  await logActivity({ kind: "converted", summary: `Converted to opportunity: ${title}`, actorId: input.createdBy, contactCrmId: input.contactCrmId ?? null, opportunityId: String(data.id) });
  return getOpportunity(String(data.id));
}

export type UpdateOpportunityPatch = {
  title?: string; stageId?: string | null; valueCents?: number | null; billing?: "yearly" | "monthly";
  probability?: number | null; expectedClose?: string | null; priority?: number; tags?: string[];
  source?: string | null; leadStatus?: string | null; status?: Opportunity["status"]; notes?: string | null;
};

export async function updateOpportunity(id: string, patch: UpdateOpportunityPatch, actorId?: string | null): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.stageId !== undefined) update.stage_id = patch.stageId || null;
  if (patch.valueCents !== undefined) update.value_cents = patch.valueCents;
  if (patch.billing !== undefined) update.billing = patch.billing;
  if (patch.probability !== undefined) update.probability = patch.probability;
  if (patch.expectedClose !== undefined) update.expected_close = patch.expectedClose || null;
  if (patch.priority !== undefined) update.priority = Math.max(0, Math.min(3, patch.priority));
  if (patch.tags !== undefined) update.tags = patch.tags.map((t) => t.trim()).filter(Boolean).slice(0, 20);
  if (patch.source !== undefined) update.source = patch.source || null;
  if (patch.leadStatus !== undefined) update.lead_status = patch.leadStatus || null;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.notes !== undefined) update.notes = patch.notes;
  const { error } = await db().from("sales_opportunities").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  if (patch.status === "won") await logActivity({ kind: "won", summary: "Opportunity marked won", actorId, opportunityId: id });
  else if (patch.status === "lost") await logActivity({ kind: "lost", summary: "Opportunity marked lost", actorId, opportunityId: id });
  else if (patch.status === "archived") await logActivity({ kind: "stage_changed", summary: "Opportunity archived", actorId, opportunityId: id });
  if (patch.stageId !== undefined && patch.status === undefined) {
    const { data: st } = await db().from("sales_stages").select("name").eq("id", patch.stageId).maybeSingle();
    await logActivity({ kind: "stage_changed", summary: `Stage changed to ${st?.name ?? "—"}`, actorId, opportunityId: id });
  }
  if (patch.notes !== undefined && patch.status === undefined && patch.stageId === undefined) {
    await logActivity({ kind: "opp_note", summary: "Note added to opportunity", actorId, opportunityId: id });
  }
}

export async function deleteOpportunity(id: string): Promise<void> {
  const { error } = await db().from("sales_opportunities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
