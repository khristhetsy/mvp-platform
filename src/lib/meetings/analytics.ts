// Weekly Meeting System — zero-copy analytics (spec §6). The 📡 department sub-tab reads
// the SAME source the Hub pages use: it delegates to the existing Hub metric libraries
// (sales-analytics, ir-analytics) and the marketing lead-lifecycle counts. No ETL, no
// duplicated logic — meeting code never reimplements Hub internals, just calls them.
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { loadSalesAnalytics } from "@/lib/sales-analytics/metrics";
import { loadIrAnalytics } from "@/lib/ir-analytics/metrics";
import { marketingLifecycle } from "@/lib/lifecycle/counts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface MeetingAnalyticsMetric { label: string; value: string; delta?: string }
export interface MeetingAnalytics {
  available: boolean;
  source: string;               // which Hub these came from
  hubHref: string | null;       // link to the live Hub page
  metrics: MeetingAnalyticsMetric[];
}

const NONE: MeetingAnalytics = { available: false, source: "", hubHref: null, metrics: [] };

/** Resolve a department to its Hub and return that Hub's headline metrics (read-only). */
export async function getMeetingAnalytics(departmentId: string): Promise<MeetingAnalytics> {
  const { data: dept } = await db().from("departments").select("key, hub_key, name").eq("id", departmentId).maybeSingle();
  if (!dept) return NONE;
  const key = String(dept.key ?? "").toLowerCase();
  const hub = String(dept.hub_key ?? "").toLowerCase();

  if (key === "sales" || hub === "sales") {
    const m = await loadSalesAnalytics();
    return { available: true, source: "Sales Hub", hubHref: "/admin/sales/analytics", metrics: m.slice(0, 6).map((x) => ({ label: x.label, value: x.value, delta: x.delta })) };
  }
  if (key === "investor_relations" || hub === "operations" || hub === "playbook" || hub === "investor_relations") {
    const m = await loadIrAnalytics();
    return { available: true, source: "Investor Relations Hub", hubHref: "/admin/playbook?tab=analytics", metrics: m.slice(0, 6).map((x) => ({ label: x.label, value: x.value, delta: x.delta })) };
  }
  if (key === "marketing" || hub === "marketing") {
    const stages = await marketingLifecycle();
    return { available: true, source: "Marketing Hub", hubHref: "/admin/marketing", metrics: stages.map((s) => ({ label: s.label, value: String(s.count) })) };
  }
  return { ...NONE, source: dept.name ? `${dept.name} (no linked Hub)` : "" };
}
