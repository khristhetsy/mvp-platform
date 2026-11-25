// Composes the /admin dashboard: five tabs (Dashboard, Sales, Marketing, Customer Support,
// Administration) from the department metrics, the custom measures and the Sales snapshot.
// compose() is pure so it can be tested; loadAdminDashboard() does the reads.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEPARTMENT_NAME,
  loadDepartmentMetrics,
  openItemsByDepartment,
  type DepartmentId,
  type DepartmentMetric,
  type Period,
} from "@/lib/dashboard/department-metrics";
import { loadAiSpend, loadMrr, loadSalesSnapshot, loadSupportTimings, type SalesSnapshot } from "@/lib/dashboard/department-extra";

type Db = SupabaseClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type TabId = "dashboard" | DepartmentId;
export type DashAction = { text: string; tone: "bad" | "warn" | "good"; href?: string; linkLabel?: string };
export type DashRow = { label: string; value: string; color: string; href?: string; tab?: TabId };
export type DashPanel = { title: string; subtitle: string; rings: DepartmentMetric[] };
export type TabData = {
  id: TabId;
  name: string;
  title: string;
  subtitle: string;
  /** Shown top right of the main panel. Per period when it depends on one. */
  pill?: string | Record<Period, string>;
  need: { value: string; label: string; href?: string }[];
  rings: DepartmentMetric[];
  summary: string[];
  listTitle: string;
  rows: DashRow[];
  listEmpty: string;
  listLink?: { label: string; href: string };
  actions: DashAction[];
  more: DashPanel[];
  advisor: string;
};
export type DashboardData = { loadedAt: string; tabs: TabData[] };

export type ComposeInput = {
  metrics: DepartmentMetric[];
  sales: SalesSnapshot | null;
  campaigns: { id: string; name: string; status: string; sent: number }[];
  oldestRequests: { id: string; ref: string; subject: string; ageDays: number }[];
  loadedAt: string;
};

export const DEPT_COLOR: Record<DepartmentId, string> = {
  sales: "#1A6CE4",
  marketing: "#185FA5",
  support: "#0A1A40",
  administration: "#2E78F5",
};

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function compose(input: ComposeInput): TabData[] {
  const { metrics, sales, campaigns, oldestRequests, loadedAt } = input;
  const byId = new Map(metrics.map((m) => [m.id, m] as const));
  const pick = (...ids: string[]) => ids.map((id) => byId.get(id)).filter((m): m is DepartmentMetric => Boolean(m));
  const val = (id: string) => byId.get(id)?.value ?? 0;
  const measured = (m: DepartmentMetric) => !m.note;

  // Work waiting for a person, largest first. Past due requests are a subset of open ones, so they
  // are shown as their own urgent item but never added into a department total.
  const waiting = metrics.filter((m) => m.openItem && measured(m) && m.value > 0).sort((a, b) => b.value - a.value);
  const pastDue = byId.get("support_overdue");
  const needFor = (pool: DepartmentMetric[], withSales: boolean) => {
    const out = pool.slice(0, 3).map((m) => ({ value: String(m.value), label: lower(m.label), href: m.href }));
    if (pastDue && measured(pastDue) && pastDue.value > 0 && pool.some((m) => m.department === "support")) {
      out.push({ value: String(pastDue.value), label: "requests past their due date", href: pastDue.href });
    }
    if (withSales && sales) {
      if (sales.stalled.count > 0) out.push({ value: String(sales.stalled.count), label: `deals stalled ${sales.stalled.days}d+`, href: "/admin/sales/pipeline" });
      if (sales.overdueTasks > 0) out.push({ value: String(sales.overdueTasks), label: "sales tasks overdue", href: "/admin/sales/tasks" });
    }
    return out;
  };
  const advisorFor = (need: { value: string; label: string }[]) =>
    need.length ? `You have ${need.map((n) => `${n.value} ${n.label}`).join(", ")}.` : "Nothing measured is waiting on a person right now.";
  const actionsFor = (pool: DepartmentMetric[]): DashAction[] =>
    pool.length
      ? pool.slice(0, 4).map((m) => ({ text: `${m.value} ${lower(m.label)}`, tone: m.higherIsWorse ? "bad" : "warn", href: m.href, linkLabel: "Open →" }))
      : [{ text: "Nothing measured is waiting on a person", tone: "good" }];

  // ----- Dashboard
  const companies = val("sales_companies");
  const raises = val("sales_active_raises");
  const raisesMetric = byId.get("sales_active_raises");
  const raisesPct = companies > 0 ? Math.round((raises / companies) * 100) : null;
  const overviewRings = pick("sales_companies", "sales_investors", "sales_active_raises", "sales_pending_reviews", "admin_compliance", "admin_spv", "admin_upgrades").map((m) =>
    m === raisesMetric ? { ...m, percent: raisesPct, definition: `${m.definition}. The ring shows the share of all companies.` } : m,
  );
  const openRows = openItemsByDepartment(metrics);
  const totalOpen = openRows.reduce((a, r) => a + (r.measured ? r.total : 0), 0);
  const largest = waiting[0];
  const dashNeed = needFor(waiting, true);
  const dashboard: TabData = {
    id: "dashboard", name: "Dashboard", title: "Platform lifecycle", subtitle: `${companies} companies`,
    pill: raisesPct === null ? `${raises} active raises` : `${raises} active raises · ${raisesPct}% of companies`,
    need: dashNeed, rings: overviewRings,
    summary: [`${totalOpen} items waiting on a person across measured departments`, largest ? `Largest open queue: ${largest.label}` : "No open queue"],
    listTitle: "Open items by department",
    rows: openRows.map((r) => ({
      label: DEPARTMENT_NAME[r.department], value: r.measured ? `${r.total} open` : "Not measured",
      color: DEPT_COLOR[r.department], tab: r.department,
    })),
    listEmpty: "", actions: actionsFor(waiting), more: [], advisor: advisorFor(dashNeed),
  };

  // ----- Sales
  const salesNeed = needFor(waiting.filter((m) => m.department === "sales"), true);
  const stageRings = sales?.stages ?? [];
  const winPill = sales
    ? ({ week: "", month: "", year: "" } as Record<Period, string>)
    : undefined;
  if (sales && winPill) {
    for (const p of ["week", "month", "year"] as const) {
      const w = sales.winRate[p];
      winPill[p] = `${w === null ? "Win rate: none won or lost" : `Win rate ${w}% this ${p}`} · ${sales.wonAllTime} won all-time`;
    }
  }
  const salesActions: DashAction[] = [];
  if (sales) {
    if (sales.stalled.count > 0) salesActions.push({ text: `${sales.stalled.count} deals stalled ${sales.stalled.days}d+, worth ${money(sales.stalled.value)}`, tone: "bad", href: "/admin/sales/pipeline", linkLabel: "Review →" });
    if (sales.overdueTasks > 0) salesActions.push({ text: `${sales.overdueTasks} tasks overdue, follow ups past due`, tone: "warn", href: "/admin/sales/tasks", linkLabel: "Open tasks →" });
  }
  const salesTab: TabData = {
    id: "sales", name: "Sales", title: "Sales lifecycle", subtitle: sales ? `${sales.openCount} in funnel` : "pipeline not available",
    pill: winPill, need: salesNeed,
    rings: stageRings.length ? stageRings : [{ id: "sales_stage_none", department: "sales", label: "Pipeline", detail: "", flowLabel: null, value: 0, valueText: "n/a", changes: null, weekly: null, note: "Not available: the pipeline could not be read." }],
    summary: sales
      ? [`${sales.openCount} open opportunities`, `${money(sales.pipelineValue)} pipeline (weighted ${money(sales.weightedValue)})`, `${money(sales.expectedMrr)} expected MRR`, ...(sales.bottleneck ? [`Bottleneck: ${sales.bottleneck}`] : [])]
      : ["Pipeline figures could not be read"],
    listTitle: "Top opportunities by value",
    rows: (sales?.topMovers ?? []).map((o) => ({ label: o.name, value: `${o.stage} · ${money(o.value)}`, color: DEPT_COLOR.sales, href: `/admin/sales/opportunities/${o.id}` })),
    listEmpty: "No open opportunities.",
    listLink: { label: "View pipeline →", href: "/admin/sales/pipeline" },
    actions: salesActions.length ? salesActions : [{ text: "Nothing urgent in the pipeline", tone: "good" }],
    more: [
      { title: "Subscriptions and demos", subtitle: "trials, plans and demo requests", rings: [...pick("sales_trials", "sales_paying", "sales_demos"), ...(sales ? [sales.newOpportunities] : [])] },
      { title: "Efficiency", subtitle: "monthly recurring revenue, latest complete month", rings: pick("sales_mrr_new", "sales_mrr_churned", "sales_mrr_ending") },
    ],
    advisor: sales ? `You have ${sales.openCount} open opportunities worth ${money(sales.pipelineValue)}${sales.stalled.count ? `, and ${sales.stalled.count} stalled ${sales.stalled.days}+ days` : ""}.` : "Pipeline figures could not be read.",
  };

  // ----- Marketing
  const marketing: TabData = {
    id: "marketing", name: "Marketing", title: "Marketing activity", subtitle: "campaigns and contacts", need: [],
    rings: pick("marketing_contacts", "marketing_sent", "marketing_opened", "marketing_clicked", "marketing_campaigns_sent"),
    summary: ["Open rate and click rate are not shown: they need a sent count above zero in the same period"],
    listTitle: "Latest campaigns",
    rows: campaigns.map((c) => ({ label: c.name, value: `${c.status} · ${c.sent} sent`, color: DEPT_COLOR.marketing, href: "/admin/marketing/campaigns" })),
    listEmpty: "No campaigns yet.", listLink: { label: "Open marketing →", href: "/admin/marketing" },
    actions: [{ text: "Marketing has no open item counts, so nothing is flagged here", tone: "good" }],
    more: [{ title: "More", subtitle: "unsubscribes and feedback", rings: pick("marketing_unsubscribes", "marketing_feedback") }],
    advisor: "Marketing shows activity counts only. No action count is measured for it.",
  };

  // ----- Customer Support
  const supportWaiting = waiting.filter((m) => m.department === "support");
  const supportNeed = needFor(supportWaiting, false);
  const support: TabData = {
    id: "support", name: "Customer Support", title: "Support desk", subtitle: "48 hour turnaround target", need: supportNeed,
    rings: pick("support_open", "support_overdue", "support_resolved", "support_reopened"),
    summary: ["Turnaround is measured against the 48 hour target"],
    listTitle: "Oldest open requests",
    rows: oldestRequests.map((r) => ({ label: `${r.ref} ${r.subject}`.trim(), value: `${r.ageDays}d old`, color: DEPT_COLOR.support, href: "/admin/support" })),
    listEmpty: "No open requests.", listLink: { label: "Open support →", href: "/admin/support" },
    actions: pastDue && measured(pastDue) && pastDue.value > 0
      ? [{ text: `${pastDue.value} requests past their due date`, tone: "bad", href: "/admin/support", linkLabel: "Open →" }]
      : [{ text: "No requests past their due date", tone: "good" }],
    more: [{ title: "Efficiency", subtitle: "time to act against your 48 hour target", rings: pick("support_first_response", "support_resolve_time", "support_rating") }],
    advisor: advisorFor(supportNeed),
  };

  // ----- Administration
  const adminWaiting = waiting.filter((m) => m.department === "administration");
  const adminNeed = needFor(adminWaiting, false);
  const administration: TabData = {
    id: "administration", name: "Administration", title: "Administration", subtitle: "compliance, SPVs and approvals", need: adminNeed,
    rings: pick("admin_compliance", "admin_spv", "admin_investor_approvals", "admin_upgrades", "admin_intros"),
    summary: [`${adminWaiting.reduce((a, m) => a + m.value, 0)} items waiting on a person`, ...(adminWaiting[0] ? [`Largest open queue: ${adminWaiting[0].label}`] : [])],
    listTitle: "Open items",
    rows: pick("admin_compliance", "admin_spv", "admin_investor_approvals", "admin_intros", "admin_kyc", "admin_upgrades", "admin_unapplied")
      .map((m) => ({ label: m.label, value: m.note ? "Not available" : String(m.value), color: DEPT_COLOR.administration, href: m.href })),
    listEmpty: "", listLink: { label: "Open compliance →", href: "/admin/compliance" },
    actions: actionsFor(adminWaiting),
    more: [
      { title: "Interest, approvals and billing", subtitle: "indications of interest, KYC, invoices and readiness", rings: pick("admin_interest", "admin_kyc", "admin_invoices", "admin_unapplied", "admin_scores") },
      { title: "Efficiency", subtitle: "AI spend against budget", rings: pick("admin_ai_spend") },
    ],
    advisor: advisorFor(adminNeed),
  };

  void loadedAt;
  return [dashboard, salesTab, marketing, support, administration];
}

export async function loadAdminDashboard(db: Db, now: Date = new Date()): Promise<DashboardData> {
  const nowMs = now.getTime();
  type Rows = { data: unknown[] | null };
  const safe = async (p: PromiseLike<Rows>): Promise<Rows> => {
    try { return await p; } catch { return { data: null }; }
  };
  const [base, support, ai, mrr, sales, camp, oldest] = await Promise.all([
    loadDepartmentMetrics(db, now),
    loadSupportTimings(db, nowMs),
    loadAiSpend(db, nowMs),
    loadMrr(db, nowMs),
    loadSalesSnapshot(db, nowMs),
    safe(db.from("marketing_campaigns").select("id, name, status, stat_sent, sent_at, created_at").eq("archived", false).order("created_at", { ascending: false }).limit(4)),
    safe(db.from("support_requests").select("id, ref_no, subject, created_at").in("status", ["open", "pending_founder"]).order("created_at", { ascending: true }).limit(4)),
  ]);
  const campaigns = ((camp.data ?? []) as Array<{ id: string; name: string | null; status: string | null; stat_sent: number | null }>).map((c) => ({
    id: String(c.id), name: c.name ?? "Untitled campaign", status: c.status ?? "unknown", sent: Number(c.stat_sent ?? 0),
  }));
  const oldestRequests = ((oldest.data ?? []) as Array<{ id: string; ref_no: string | null; subject: string | null; created_at: string }>).map((r) => ({
    id: String(r.id), ref: r.ref_no ?? "", subject: r.subject ?? "Request", ageDays: Math.max(0, Math.floor((nowMs - Date.parse(r.created_at)) / 86_400_000)),
  }));
  const loadedAt = now.toISOString();
  return { loadedAt, tabs: compose({ metrics: [...base, ...support, ai, ...mrr], sales, campaigns, oldestRequests, loadedAt }) };
}
