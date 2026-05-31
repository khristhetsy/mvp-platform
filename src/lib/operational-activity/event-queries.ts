import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OperationalActivityFeedFilters,
  OperationalActivityFeedItem,
  OperationalActivityFeedResult,
  OperationalEventCategory,
  OperationalEventSeverity,
} from "@/lib/operational-activity/types";
import type { Database } from "@/lib/supabase/types";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function normalizeList<T extends string>(value: T | T[] | undefined): T[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export async function getOperationalActivityFeed(
  supabase: SupabaseClient<Database>,
  filters: OperationalActivityFeedFilters = {},
): Promise<OperationalActivityFeedResult> {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = filters.offset ?? 0;

  let query = supabase
    .from("operational_activity_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const categories = normalizeList(filters.category);
  if (categories?.length) {
    query = query.in("event_category", categories);
  }

  if (filters.companyId) query = query.eq("company_id", filters.companyId);
  if (filters.investorId) query = query.eq("investor_id", filters.investorId);
  if (filters.spvId) query = query.eq("spv_id", filters.spvId);

  const severities = normalizeList(filters.severity);
  if (severities?.length) {
    query = query.in("severity", severities);
  }

  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    query = query.lte("created_at", end.toISOString());
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(`Unable to load operational activity feed: ${error.message}`);
  }

  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((row) => row.actor_user_id).filter(Boolean))] as string[];
  const companyIds = [...new Set(rows.map((row) => row.company_id).filter(Boolean))] as string[];

  const [{ data: actors }, { data: companies }] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
    companyIds.length
      ? supabase.from("companies").select("id, company_name").in("id", companyIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
  ]);

  const actorMap = new Map((actors ?? []).map((row) => [row.id, row.full_name ?? row.email]));
  const companyMap = new Map((companies ?? []).map((row) => [row.id, row.company_name]));

  const items: OperationalActivityFeedItem[] = rows.map((row) => ({
    id: row.id,
    event_type: row.event_type,
    event_category: row.event_category as OperationalEventCategory,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    actor_user_id: row.actor_user_id,
    actor_role: row.actor_role,
    company_id: row.company_id,
    investor_id: row.investor_id,
    spv_id: row.spv_id,
    severity: row.severity as OperationalEventSeverity,
    title: row.title,
    description: row.description,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    source_module: row.source_module,
    visibility: row.visibility as OperationalActivityFeedItem["visibility"],
    created_at: row.created_at,
    actor_name: row.actor_user_id ? (actorMap.get(row.actor_user_id) ?? null) : null,
    company_name: row.company_id ? (companyMap.get(row.company_id) ?? null) : null,
  }));

  const total = count ?? items.length;
  return {
    items,
    total,
    hasMore: offset + items.length < total,
  };
}

/** Foundation for entity-scoped timelines (company / investor / SPV pages — Phase 2+). */
export async function getOperationalTimelineForEntity(
  supabase: SupabaseClient<Database>,
  input: {
    entityType: string;
    entityId: string;
    limit?: number;
  },
) {
  const limit = Math.min(input.limit ?? 25, MAX_LIMIT);
  const { data, error } = await supabase
    .from("operational_activity_events")
    .select("*")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
