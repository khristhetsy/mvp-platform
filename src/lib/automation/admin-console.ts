import type { SupabaseClient } from "@supabase/supabase-js";
import { getAutomationDailySummary } from "@/lib/automation/automation-log";
import type { AutomationRuleResult } from "@/lib/automation/types";
import type {
  AutomationActionListItem,
  AutomationConsoleFilters,
  AutomationConsolePayload,
  AutomationCronVisibility,
  AutomationDependencyInsight,
  AutomationRunDetail,
  AutomationRunListItem,
  AutomationRunStatus,
  AutomationSafetySummary,
  AutomationTimelineItem,
  SanitizedAutomationRunMetadata,
} from "@/lib/automation/admin-console-types";
import { getLatestOrchestrationRun } from "@/lib/notifications/orchestration/execution-log";
import type { Database } from "@/lib/supabase/types";

const AUTOMATION_EVENT_TYPES = [
  "workflow_automation_triggered",
  "workflow_automation_completed",
  "workflow_automation_skipped",
  "workflow_dependency_detected",
  "workflow_dependency_resolved",
] as const;

const DEFAULT_LIMIT = 50;

function dayStartIso(): string {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  return dayStart.toISOString();
}

function sanitizeMetadata(raw: Record<string, unknown> | null | undefined): SanitizedAutomationRunMetadata {
  if (!raw || typeof raw !== "object") return {};
  const results: AutomationRuleResult[] | undefined = Array.isArray(raw.results)
    ? raw.results.slice(0, 50).map((r) => {
        const row = r as Record<string, unknown>;
        const entry: AutomationRuleResult = {
          ruleId: String(row.ruleId ?? "").slice(0, 120),
          status: (row.status as AutomationRuleResult["status"]) ?? "skipped",
          message: String(row.message ?? "").slice(0, 300),
        };
        if (row.actionType && typeof row.actionType === "string") {
          entry.actionType = row.actionType as AutomationRuleResult["actionType"];
        }
        return entry;
      })
    : undefined;

  const errors = Array.isArray(raw.errors)
    ? raw.errors
        .slice(0, 20)
        .map((e) => {
          const row = e as Record<string, unknown>;
          return {
            step: String(row.step ?? "unknown").slice(0, 80),
            message: String(row.message ?? "").slice(0, 200),
          };
        })
    : undefined;

  const executed_dedupe_keys = Array.isArray(raw.executed_dedupe_keys)
    ? raw.executed_dedupe_keys.map((k) => String(k).slice(0, 120)).slice(0, 30)
    : undefined;

  return {
    blockers_detected: typeof raw.blockers_detected === "number" ? raw.blockers_detected : undefined,
    dependencies_resolved:
      typeof raw.dependencies_resolved === "number" ? raw.dependencies_resolved : undefined,
    results,
    errors,
    executed_dedupe_keys,
  };
}

function mapRunRow(row: Record<string, unknown>): AutomationRunListItem {
  const meta = sanitizeMetadata(row.metadata as Record<string, unknown>);
  const results = meta.results ?? [];
  return {
    id: String(row.id),
    status: (row.status as AutomationRunStatus) ?? "running",
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : null,
    triggerType: row.trigger_type ? String(row.trigger_type) : null,
    sourceEventId: row.source_event_id ? String(row.source_event_id) : null,
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    dryRun: Boolean(row.dry_run),
    actionsExecuted: Number(row.actions_executed ?? 0),
    actionsSkipped: Number(row.actions_skipped ?? 0),
    failuresCount: Number(row.failures_count ?? 0),
    blockersDetected: meta.blockers_detected ?? 0,
    dependenciesResolved: meta.dependencies_resolved ?? 0,
    automationsTriggered: results.length,
  };
}

export function parseAutomationConsoleFilters(
  params: URLSearchParams,
): AutomationConsoleFilters {
  const dryRunParam = params.get("dryRun");
  return {
    status: (params.get("status") as AutomationRunStatus | null) ?? undefined,
    triggerType: params.get("trigger") ?? undefined,
    dryRun: dryRunParam === "true" ? true : dryRunParam === "false" ? false : undefined,
    entityType: params.get("entityType") ?? undefined,
    failuresOnly: params.get("failures") === "true",
    dateFrom: params.get("from") ?? undefined,
    dateTo: params.get("to") ?? undefined,
    q: params.get("q") ?? undefined,
    limit: Math.min(Number(params.get("limit") ?? DEFAULT_LIMIT), DEFAULT_LIMIT),
    offset: Math.max(0, Number(params.get("offset") ?? 0)),
  };
}

export async function loadAutomationConsole(
  supabase: SupabaseClient<Database>,
  filters: AutomationConsoleFilters,
): Promise<AutomationConsolePayload> {
  const dayStart = dayStartIso();

  let query = supabase
    .from("automation_runs")
    .select("*", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.triggerType) query = query.eq("trigger_type", filters.triggerType);
  if (filters.dryRun !== undefined) query = query.eq("dry_run", filters.dryRun);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.failuresOnly) query = query.gt("failures_count", 0);
  if (filters.dateFrom) query = query.gte("started_at", filters.dateFrom);
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setUTCHours(23, 59, 59, 999);
    query = query.lte("started_at", end.toISOString());
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  let runs = (data ?? []).map((row) => mapRunRow(row as Record<string, unknown>));

  if (filters.q?.trim()) {
    const needle = filters.q.trim().toLowerCase();
    runs = runs.filter(
      (run) =>
        run.triggerType?.toLowerCase().includes(needle) ||
        run.entityType?.toLowerCase().includes(needle) ||
        run.entityId?.toLowerCase().includes(needle) ||
        run.status.includes(needle),
    );
  }

  const [daily, lastOrchestration, timelineRows, blockerRows, durationRows, safetyRows] =
    await Promise.all([
      getAutomationDailySummary(supabase),
      getLatestOrchestrationRun(supabase),
      supabase
        .from("operational_activity_events")
        .select("id, event_type, title, created_at, severity")
        .in("event_type", [...AUTOMATION_EVENT_TYPES])
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("operational_activity_events")
        .select("id, title, entity_type, entity_id")
        .eq("event_type", "workflow_dependency_detected")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("automation_runs")
        .select("duration_ms")
        .gte("started_at", dayStart)
        .not("duration_ms", "is", null)
        .limit(50),
      supabase
        .from("automation_actions")
        .select("status, message, metadata, created_at")
        .gte("created_at", dayStart)
        .limit(100),
    ]);

  const durations = (durationRows.data ?? [])
    .map((r) => r.duration_ms)
    .filter((v): v is number => typeof v === "number");
  const avgDurationMs =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const [cronRunsToday, manualRunsToday, failedCronToday] = await Promise.all([
    supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", dayStart)
      .eq("trigger_type", "scheduled_scan"),
    supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", dayStart)
      .neq("trigger_type", "scheduled_scan"),
    supabase
      .from("orchestration_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", dayStart)
      .eq("trigger_source", "cron")
      .in("status", ["failed", "partial"]),
  ]);

  const cron: AutomationCronVisibility = {
    lastOrchestrationAt: lastOrchestration?.started_at ?? null,
    lastOrchestrationStatus: lastOrchestration?.status ?? null,
    cronAutomationRunsToday: cronRunsToday.count ?? 0,
    manualRunsToday: manualRunsToday.count ?? 0,
    failedCronOrchestrationToday: failedCronToday.count ?? 0,
  };

  const [dryRunsToday] = await Promise.all([
    supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", dayStart)
      .eq("dry_run", true),
  ]);

  const safety = buildSafetySummary(
    safetyRows.data ?? [],
    daily.staleChains,
    dryRunsToday.count ?? 0,
  );
  const ruleFrequency = aggregateRuleFrequencyFromRows(data ?? []);
  const topBlockers = buildTopBlockers(blockerRows.data ?? []);

  const timeline: AutomationTimelineItem[] = (timelineRows.data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    createdAt: row.created_at,
    severity: row.severity,
  }));

  return {
    runs,
    total: count ?? runs.length,
    stats: {
      runsToday: daily.automationsTriggeredToday,
      failuresToday: daily.automationFailuresToday,
      blockedWorkflows: daily.blockedWorkflows,
      automationsTriggeredToday: daily.automationsTriggeredToday,
      dependenciesResolvedToday: daily.dependenciesResolvedToday,
      avgDurationMs,
    },
    cron,
    safety,
    timeline,
    topBlockers,
    ruleFrequency,
  };
}

function buildSafetySummary(
  actions: Array<{ status: string; message: string | null; metadata: Record<string, unknown> }>,
  staleChains: number,
  dryRunsToday: number,
): AutomationSafetySummary {
  let guardSkipsToday = 0;
  let cooldownSkipsToday = 0;
  let dedupePreventionsToday = 0;

  for (const row of actions) {
    const msg = (row.message ?? "").toLowerCase();
    if (row.status === "skipped") {
      guardSkipsToday += 1;
      if (msg.includes("cooldown") || msg.includes("guard")) cooldownSkipsToday += 1;
    }
    const meta = row.metadata ?? {};
    if (meta.dedupe_key) dedupePreventionsToday += 1;
  }

  return {
    dryRunsToday,
    guardSkipsToday,
    dedupePreventionsToday,
    cooldownSkipsToday,
    recursionPreventionsToday: staleChains,
  };
}

function aggregateRuleFrequencyFromRows(
  rows: Array<{ metadata: Record<string, unknown> | null; trigger_type: string | null }>,
): Array<{ ruleId: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const meta = sanitizeMetadata(row.metadata as Record<string, unknown>);
    for (const result of meta.results ?? []) {
      counts.set(result.ruleId, (counts.get(result.ruleId) ?? 0) + 1);
    }
    if (!meta.results?.length && row.trigger_type) {
      counts.set(row.trigger_type, (counts.get(row.trigger_type) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildTopBlockers(
  rows: Array<{ id: string; title: string; entity_type: string | null; entity_id: string | null }>,
): AutomationDependencyInsight[] {
  const counts = new Map<string, { label: string; count: number; href: string | null }>();
  for (const row of rows) {
    const label = row.title.slice(0, 120);
    const existing = counts.get(label);
    const href =
      row.entity_type === "company" && row.entity_id
        ? `/admin/companies/${row.entity_id}`
        : row.entity_type === "spv"
          ? "/admin/spvs"
          : null;
    if (existing) existing.count += 1;
    else counts.set(label, { label, count: 1, href });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((item, index) => ({
      id: `blocker-${index}`,
      label: item.label,
      count: item.count,
      href: item.href,
    }));
}

export async function loadAutomationRunDetail(
  supabase: SupabaseClient<Database>,
  runId: string,
): Promise<AutomationRunDetail | null> {
  const { data: run, error } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error || !run) return null;

  const base = mapRunRow(run as Record<string, unknown>);
  const meta = sanitizeMetadata(run.metadata as Record<string, unknown>);

  const { data: actions } = await supabase
    .from("automation_actions")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true })
    .limit(50);

  const actionItems: AutomationActionListItem[] = (actions ?? []).map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const message = row.message ?? "";
    let skipReason: string | null = null;
    if (row.status === "skipped") {
      skipReason = message.toLowerCase().includes("cooldown")
        ? "Cooldown window active"
        : message.toLowerCase().includes("guard")
          ? "Guard prevented execution"
          : "Skipped by automation guard";
    }
    return {
      id: row.id,
      actionType: row.action_type,
      status: row.status,
      message: message.slice(0, 500),
      targetEntityType: row.target_entity_type,
      targetEntityId: row.target_entity_id,
      createdAt: row.created_at,
      skipReason,
      dedupeKey: metadata.dedupe_key ? String(metadata.dedupe_key) : null,
    };
  });

  const since = run.started_at;
  const until = run.completed_at ?? new Date().toISOString();
  const { data: events } = await supabase
    .from("operational_activity_events")
    .select("id, event_type, title, created_at, entity_type, entity_id")
    .in("event_type", [...AUTOMATION_EVENT_TYPES])
    .gte("created_at", since)
    .lte("created_at", until)
    .order("created_at", { ascending: false })
    .limit(15);

  const ruleFrequency = aggregateRuleFrequencyFromMeta(meta);

  return {
    ...base,
    automationsTriggered: ruleFrequency.reduce((sum, r) => sum + r.count, 0) || meta.results?.length || 0,
    metadata: meta,
    actions: actionItems,
    relatedEvents: (events ?? []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      title: e.title,
      createdAt: e.created_at,
      entityType: e.entity_type,
      entityId: e.entity_id,
    })),
  };
}

function aggregateRuleFrequencyFromMeta(meta: SanitizedAutomationRunMetadata) {
  const counts = new Map<string, number>();
  for (const r of meta.results ?? []) {
    counts.set(r.ruleId, (counts.get(r.ruleId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([ruleId, count]) => ({ ruleId, count }));
}
