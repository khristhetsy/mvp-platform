import type { TrendPoint, TrendSeries, TrendWindowDays } from "@/lib/analytics/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function toUtcDay(iso: string): string {
  const date = new Date(iso);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function listUtcDaysBack(windowDays: TrendWindowDays, now = new Date()): string[] {
  const days: string[] = [];
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    days.push(toUtcDay(d.toISOString()));
  }
  return days;
}

export function buildDailyCountSeries(input: {
  key: string;
  label: string;
  windowDays: TrendWindowDays;
  timestamps: string[];
}): TrendSeries {
  const dayKeys = listUtcDaysBack(input.windowDays);
  const counts = new Map(dayKeys.map((d) => [d, 0]));

  for (const ts of input.timestamps) {
    const day = toUtcDay(ts);
    if (counts.has(day)) {
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }

  const points: TrendPoint[] = dayKeys.map((day) => ({ day, value: counts.get(day) ?? 0 }));
  return {
    key: input.key,
    label: input.label,
    points,
    total: points.reduce((sum, p) => sum + p.value, 0),
  };
}

function sinceIso(windowDays: TrendWindowDays): string {
  return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
}

export async function loadTrendGroups(
  supabase: SupabaseClient<Database>,
  windowDays: TrendWindowDays,
): Promise<{
  platformActivity: TrendSeries[];
  investorEngagement: TrendSeries[];
  compliance: TrendSeries[];
  importsExports: TrendSeries[];
  collaboration: TrendSeries[];
  automation: TrendSeries[];
}> {
  const since = sinceIso(windowDays);

  const [
    interests,
    intros,
    saved,
    meetings,
    messages,
    complianceCreated,
    complianceResolved,
    imports,
    exports,
    comments,
    automationRuns,
  ] = await Promise.all([
    supabase.from("investor_interests").select("created_at").gte("created_at", since).limit(5000),
    supabase.from("intro_requests").select("created_at").gte("created_at", since).limit(5000),
    supabase.from("saved_deals").select("created_at").gte("created_at", since).limit(5000),
    supabase.from("thread_meetings").select("created_at").gte("created_at", since).limit(5000),
    supabase.from("message_threads").select("created_at").gte("created_at", since).limit(5000),
    supabase.from("compliance_events").select("created_at").gte("created_at", since).limit(5000),
    supabase.from("compliance_events").select("reviewed_at").eq("status", "resolved").gte("reviewed_at", since).limit(5000),
    supabase.from("import_batches").select("created_at").gte("created_at", since).limit(5000),
    supabase
      .from("operational_activity_events")
      .select("created_at, event_type")
      .in("event_type", ["export_generated", "report_generated"])
      .gte("created_at", since)
      .limit(5000),
    supabase.from("collaboration_comments").select("created_at").gte("created_at", since).limit(5000),
    supabase.from("automation_runs").select("started_at, status").gte("started_at", since).limit(5000),
  ]);

  const platformActivity: TrendSeries[] = [
    buildDailyCountSeries({
      key: "interests",
      label: "Interests",
      windowDays,
      timestamps: (interests.data ?? []).map((r) => r.created_at as string),
    }),
    buildDailyCountSeries({
      key: "intros",
      label: "Intro requests",
      windowDays,
      timestamps: (intros.data ?? []).map((r) => r.created_at as string),
    }),
    buildDailyCountSeries({
      key: "saved",
      label: "Saved deals",
      windowDays,
      timestamps: (saved.data ?? []).map((r) => r.created_at as string),
    }),
    buildDailyCountSeries({
      key: "messages",
      label: "Message threads",
      windowDays,
      timestamps: (messages.data ?? []).map((r) => r.created_at as string),
    }),
    buildDailyCountSeries({
      key: "meetings",
      label: "Meetings",
      windowDays,
      timestamps: (meetings.data ?? []).map((r) => r.created_at as string),
    }),
  ];

  const investorEngagement: TrendSeries[] = [
    platformActivity[0],
    platformActivity[1],
    platformActivity[2],
  ];

  const compliance: TrendSeries[] = [
    buildDailyCountSeries({
      key: "compliance_created",
      label: "Compliance created",
      windowDays,
      timestamps: (complianceCreated.data ?? []).map((r) => r.created_at as string),
    }),
    buildDailyCountSeries({
      key: "compliance_resolved",
      label: "Compliance resolved",
      windowDays,
      timestamps: (complianceResolved.data ?? []).map((r) => r.reviewed_at as string),
    }),
  ];

  const exportsTimestamps = (exports.data ?? []).map((r) => r.created_at as string);
  const importsExports: TrendSeries[] = [
    buildDailyCountSeries({
      key: "imports",
      label: "Imports",
      windowDays,
      timestamps: (imports.data ?? []).map((r) => r.created_at as string),
    }),
    buildDailyCountSeries({
      key: "exports",
      label: "Exports",
      windowDays,
      timestamps: exportsTimestamps,
    }),
  ];

  const collaboration: TrendSeries[] = [
    buildDailyCountSeries({
      key: "collaboration_comments",
      label: "Collaboration comments",
      windowDays,
      timestamps: (comments.data ?? []).map((r) => r.created_at as string),
    }),
  ];

  const automation: TrendSeries[] = [
    buildDailyCountSeries({
      key: "automation_runs",
      label: "Automation runs",
      windowDays,
      timestamps: (automationRuns.data ?? []).map((r) => r.started_at as string),
    }),
    buildDailyCountSeries({
      key: "automation_failed_partial",
      label: "Automation failed/partial",
      windowDays,
      timestamps: (automationRuns.data ?? [])
        .filter((r) => ["failed", "partial"].includes(String(r.status)))
        .map((r) => r.started_at as string),
    }),
  ];

  return {
    platformActivity,
    investorEngagement,
    compliance,
    importsExports,
    collaboration,
    automation,
  };
}

