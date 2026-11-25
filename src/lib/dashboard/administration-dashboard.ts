// Administration dashboard: users, compliance, SPV blockers, approvals and billing requests in one
// read. buildAdministrationDashboard() is pure so it can be tested; loadAdministrationDashboard()
// does the reads. Figures come from the department metrics and the admin queues that already exist.
// A figure or record list that cannot be read is null and the page says so. Nothing is estimated.

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDepartmentMetrics, type DepartmentMetric } from "@/lib/dashboard/department-metrics";
import { getAdminQueueSummary } from "@/lib/queues/admin-queues";
import type { MetricDetail, MetricRecord } from "@/components/ui/MetricDetailDrawer";

type Db = SupabaseClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type UserCounts = {
  total: number;
  active: number;
  inactive: number;
  /** Invited and not yet signed in. Null when the auth list could not be read. */
  invited: number | null;
  byRole: { role: string; count: number }[];
};

/** Record lists for the popups. A null list means the read failed. */
export type DashRecords = {
  recentUsers: MetricRecord[] | null;
  inactiveUsers: MetricRecord[] | null;
  invitedUsers: MetricRecord[] | null;
  compliance: MetricRecord[] | null;
  spv: MetricRecord[] | null;
  reviews: MetricRecord[] | null;
  upgrades: MetricRecord[] | null;
  approvals: MetricRecord[] | null;
  invoices: MetricRecord[] | null;
};

export type AdminDashInput = {
  metrics: DepartmentMetric[];
  users: UserCounts | null;
  spvBlockers: number | null;
  pendingReviews: number | null;
  records?: DashRecords | null;
};

export type QueueRow = {
  key: string;
  label: string;
  /** Null when the count could not be read. */
  open: number | null;
  href: string;
};

export type AttentionItem = { tone: "bad" | "warn" | "good"; text: string; popup: string };

export type Popup = {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  flag?: { text: string; tone?: "good" | "warn" | "bad" } | null;
  extra: MetricDetail;
};

export type AdministrationDashboard = {
  users: UserCounts | null;
  compliance: number | null;
  spvBlockers: number | null;
  pendingReviews: number | null;
  queues: QueueRow[];
  access: { label: string; value: number | null; href: string; popup: string }[];
  attention: AttentionItem[];
  popups: Record<string, Popup>;
};

const NA = "Not available";
const measured = (m: DepartmentMetric | undefined): number | null => (m && !m.note ? m.value : null);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const val = (n: number | null) => (n === null ? NA : String(n));

/** Records plus the "N more" line, or the empty and failed states. */
export function recordsFor(list: MetricRecord[] | null | undefined, total: number | null, where: string, emptyText: string): Pick<MetricDetail, "records" | "recordsMore" | "recordsEmpty"> {
  if (!list) return { recordsEmpty: "The records could not be read." };
  if (list.length === 0) return { recordsEmpty: total === 0 || total === null ? emptyText : "The records could not be read." };
  const more = total !== null && total > list.length ? `${total - list.length} more in ${where}` : undefined;
  return { records: list, recordsMore: more };
}

export function buildAdministrationDashboard(input: AdminDashInput): AdministrationDashboard {
  const { metrics, users, spvBlockers, pendingReviews } = input;
  const rec = input.records ?? null;
  const byId = new Map(metrics.map((m) => [m.id, m] as const));
  const compliance = measured(byId.get("admin_compliance"));
  const upgrades = measured(byId.get("admin_upgrades"));
  const approvals = measured(byId.get("admin_investor_approvals"));
  const invoices = measured(byId.get("admin_invoices"));

  const queues: QueueRow[] = [
    { key: "compliance", label: "Compliance events", open: compliance, href: "/admin/compliance" },
    { key: "spv", label: "SPV blockers", open: spvBlockers, href: "/admin/spvs" },
    { key: "reviews", label: "Company reviews", open: pendingReviews, href: "/admin/companies" },
    { key: "upgrades", label: "Upgrade requests", open: upgrades, href: "/admin/billing" },
    { key: "approvals", label: "Investor approvals", open: approvals, href: "/admin/investors" },
  ];

  const attention: AttentionItem[] = [];
  if (compliance && compliance > 0) attention.push({ tone: "bad", popup: "compliance", text: `${compliance} open compliance ${plural(compliance, "event", "events")} to work.` });
  if (spvBlockers && spvBlockers > 0) attention.push({ tone: "warn", popup: "spv", text: `${spvBlockers} SPV ${plural(spvBlockers, "blocker needs", "blockers need")} a decision.` });
  if (approvals && approvals > 0) attention.push({ tone: "warn", popup: "approvals", text: `${approvals} investor ${plural(approvals, "profile", "profiles")} waiting for approval.` });
  if (upgrades && upgrades > 0) attention.push({ tone: "warn", popup: "upgrades", text: `${upgrades} upgrade ${plural(upgrades, "request", "requests")} pending.` });
  if (pendingReviews === 0) attention.push({ tone: "good", popup: "reviews", text: "Review queue is clear, 0 pending." });
  else if (pendingReviews && pendingReviews > 0) attention.push({ tone: "warn", popup: "reviews", text: `${pendingReviews} ${plural(pendingReviews, "company is", "companies are")} waiting for review.` });

  const UM = "/admin/users/manage";
  const popups: Record<string, Popup> = {
    users: {
      label: "Platform users", value: users ? String(users.total) : NA, unit: users ? `${users.active} active` : undefined,
      detail: "Every profile on the platform. Active means not deactivated.",
      extra: { ...recordsFor(rec?.recentUsers, users?.total ?? null, "User management", "No users yet."), recordsLabel: "Recently seen users", href: UM, hrefLabel: "Open User management" },
    },
    u_active: {
      label: "Active users", value: users ? String(users.active) : NA, unit: users ? `of ${users.total}` : undefined,
      detail: "Profiles that are not deactivated.",
      extra: { ...recordsFor(rec?.recentUsers, users?.active ?? null, "User management", "No active users."), recordsLabel: "Recently seen users", href: UM, hrefLabel: "Open User management" },
    },
    u_invited: {
      label: "Invited, not joined", value: val(users?.invited ?? null), unit: users?.invited === null || !users ? undefined : "invited",
      detail: "Invited and never signed in.",
      extra: { ...recordsFor(rec?.invitedUsers, users?.invited ?? null, "User management", "No pending invitations."), recordsLabel: "Pending invitations", href: UM, hrefLabel: "Open User management" },
    },
    u_inactive: {
      label: "Inactive users", value: users ? String(users.inactive) : NA, unit: users ? "inactive" : undefined,
      detail: "Deactivated accounts.",
      extra: { ...recordsFor(rec?.inactiveUsers, users?.inactive ?? null, "User management", "No deactivated users."), recordsLabel: "Deactivated users", href: UM, hrefLabel: "Open User management" },
    },
    u_role: {
      label: "Users by role", value: users ? String(users.total) : NA, unit: users ? "users" : undefined,
      detail: "Count of profiles per role.",
      extra: { breakdown: users ? users.byRole.map((r) => ({ label: r.role, value: String(r.count) })) : [], href: UM, hrefLabel: "Open User management" },
    },
    compliance: {
      label: "Open compliance events", value: val(compliance), unit: compliance === null ? undefined : "events",
      detail: "Compliance events with status open. There is no fixed ceiling to measure against.",
      flag: compliance && compliance > 0 ? { text: "Largest open queue", tone: "bad" } : null,
      extra: { ...recordsFor(rec?.compliance, compliance, "Compliance", "No open compliance events."), recordsLabel: "Newest open events", href: "/admin/compliance", hrefLabel: "Open Compliance" },
    },
    spv: {
      label: "SPV blockers", value: val(spvBlockers), unit: spvBlockers === null ? undefined : "open",
      detail: "Draft, under review and open SPVs with an incomplete checklist or pending investor requirements.",
      flag: spvBlockers && spvBlockers > 0 ? { text: "Needs a decision", tone: "warn" } : null,
      extra: { ...recordsFor(rec?.spv, spvBlockers, "SPVs", "No SPVs are blocked."), recordsLabel: "Blocked SPVs", href: "/admin/spvs", hrefLabel: "Open SPVs" },
    },
    reviews: {
      label: "Pending reviews", value: val(pendingReviews), unit: pendingReviews === null ? undefined : "waiting",
      detail: "Companies whose review status is pending.",
      flag: pendingReviews === 0 ? { text: "Review queue clear", tone: "good" } : null,
      extra: { ...recordsFor(rec?.reviews, pendingReviews, "Companies", "No companies are waiting for review."), recordsLabel: "Waiting for review", href: "/admin/companies", hrefLabel: "Open Companies" },
    },
    upgrades: {
      label: "Upgrade requests", value: val(upgrades), unit: upgrades === null ? undefined : "pending",
      detail: "Upgrade requests with status pending.",
      extra: { ...recordsFor(rec?.upgrades, upgrades, "Billing", "No pending upgrade requests."), recordsLabel: "Pending requests", href: "/admin/billing", hrefLabel: "Open Billing" },
    },
    approvals: {
      label: "Investor approvals", value: val(approvals), unit: approvals === null ? undefined : "pending",
      detail: "Investor profiles whose approval status is pending.",
      extra: { ...recordsFor(rec?.approvals, approvals, "Investors", "No investor profiles are waiting."), recordsLabel: "Waiting for approval", href: "/admin/investors?status=submitted", hrefLabel: "Open Investors" },
    },
    invoices: {
      label: "Open invoices", value: val(invoices), unit: invoices === null ? undefined : "sent",
      detail: "Invoices sent and not yet paid. Each opens the invoice.",
      extra: { ...recordsFor(rec?.invoices, invoices, "Accounting", "No open invoices."), recordsLabel: "Newest open invoices", href: "/admin/accounting", hrefLabel: "Open Accounting" },
    },
  };

  return {
    users, compliance, spvBlockers, pendingReviews, queues,
    access: [
      { label: "Upgrade requests", value: upgrades, href: "/admin/billing", popup: "upgrades" },
      { label: "Invited, not joined", value: users?.invited ?? null, href: UM, popup: "u_invited" },
      { label: "Open invoices", value: invoices, href: "/admin/accounting", popup: "invoices" },
    ],
    attention,
    popups,
  };
}

type ProfileRow = { id: string; full_name: string | null; email: string | null; role: string | null; is_active: boolean | null; last_seen_at: string | null };

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : "never");

async function loadUsers(db: Db): Promise<{ counts: UserCounts; recent: MetricRecord[]; inactive: MetricRecord[]; invitedList: MetricRecord[] | null } | null> {
  const { data, error } = await db.from("profiles").select("id, full_name, email, role, is_active, last_seen_at");
  if (error || !data) return null;
  const rows = data as ProfileRow[];
  const active = rows.filter((r) => r.is_active !== false).length;
  const roles = new Map<string, number>();
  for (const r of rows) roles.set(r.role ?? "unknown", (roles.get(r.role ?? "unknown") ?? 0) + 1);
  const UM = "/admin/users/manage";
  const name = (r: ProfileRow) => r.full_name ?? r.email ?? "Unnamed user";
  const recent = [...rows].sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "")).slice(0, 5)
    .map((r) => ({ label: name(r), sub: `${r.role ?? "unknown"}, seen ${when(r.last_seen_at)}`, href: UM }));
  const inactive = rows.filter((r) => r.is_active === false).slice(0, 5).map((r) => ({ label: name(r), sub: r.role ?? "unknown", href: UM }));

  let invited: number | null = null;
  let invitedList: MetricRecord[] | null = null;
  try {
    const res = await db.auth.admin.listUsers({ perPage: 1000 });
    if (!res.error) {
      const pending = (res.data?.users ?? []).filter((u: { last_sign_in_at?: string | null; invited_at?: string | null }) => !u.last_sign_in_at && !!u.invited_at);
      invited = pending.length;
      invitedList = pending.slice(0, 5).map((u: { email?: string | null; invited_at?: string | null }) => ({ label: u.email ?? "Invited user", sub: `invited ${when(u.invited_at)}`, href: UM }));
    }
  } catch {
    invited = null;
  }
  return {
    counts: {
      total: rows.length, active, inactive: rows.length - active, invited,
      byRole: [...roles.entries()].map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count),
    },
    recent, inactive, invitedList,
  };
}

async function list<T>(q: PromiseLike<{ data: unknown; error: unknown }>, map: (row: T) => MetricRecord): Promise<MetricRecord[] | null> {
  try {
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return null;
    return (data as T[]).map(map);
  } catch {
    return null;
  }
}

function money(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents == null) return "amount not set";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency ?? "USD").toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

async function loadRecords(db: Db): Promise<Omit<DashRecords, "recentUsers" | "inactiveUsers" | "invitedUsers">> {
  const [compliance, spv, reviews, upgrades, approvals, invoices] = await Promise.all([
    list<{ id: string; title: string; severity: string; created_at: string }>(
      db.from("compliance_events").select("id, title, severity, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(5),
      (r) => ({ label: r.title, sub: `${r.severity}, opened ${when(r.created_at)}`, href: `/admin/compliance?status=open&event=${r.id}` }),
    ),
    list<{ id: string; name: string; company_id: string | null; checklist_readiness_pct: number }>(
      db.from("spv_opportunities").select("id, name, company_id, checklist_readiness_pct").in("status", ["draft", "under_review", "open"])
        .or("operational_readiness_status.in.(checklist_incomplete,investors_pending,draft),investor_pending_requirements_count.gt.0,checklist_readiness_pct.lt.100").limit(5),
      (r) => ({ label: r.name, sub: `checklist ${r.checklist_readiness_pct}% ready`, href: r.company_id ? `/admin/companies/${r.company_id}` : `/admin/spvs?spv=${r.id}` }),
    ),
    list<{ id: string; company_name: string; created_at: string }>(
      db.from("companies").select("id, company_name, created_at").eq("review_status", "pending").order("created_at", { ascending: false }).limit(5),
      (r) => ({ label: r.company_name, sub: `submitted ${when(r.created_at)}`, href: `/admin/companies/${r.id}` }),
    ),
    list<{ id: string; request_type: string; requested_plan: string | null; created_at: string }>(
      db.from("upgrade_requests").select("id, request_type, requested_plan, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
      (r) => ({ label: r.requested_plan ? `${r.request_type}, ${r.requested_plan}` : r.request_type, sub: `requested ${when(r.created_at)}`, href: "/admin/billing" }),
    ),
    list<{ id: string; firm_name: string | null; submitted_at: string | null }>(
      db.from("investor_profiles").select("id, firm_name, submitted_at").eq("approval_status", "pending").order("submitted_at", { ascending: false }).limit(5),
      (r) => ({ label: r.firm_name ?? "Investor profile", sub: `submitted ${when(r.submitted_at)}`, href: "/admin/investors?status=submitted" }),
    ),
    list<{ id: string; invoice_number: string; total_cents: number | null; currency: string | null; due_date: string | null }>(
      db.from("acct_invoices").select("id, invoice_number, total_cents, currency, due_date").eq("status", "sent").order("issue_date", { ascending: false }).limit(5),
      (r) => ({ label: `Invoice ${r.invoice_number}`, sub: `${money(r.total_cents, r.currency)}, due ${when(r.due_date)}`, href: `/admin/accounting/invoices/${r.id}` }),
    ),
  ]);
  return { compliance, spv, reviews, upgrades, approvals, invoices };
}

export async function loadAdministrationDashboard(db: Db, now: Date = new Date()): Promise<AdministrationDashboard> {
  const [metrics, users, queues, records] = await Promise.all([
    loadDepartmentMetrics(db, now),
    loadUsers(db).catch(() => null),
    getAdminQueueSummary(db).catch(() => null),
    loadRecords(db).catch(() => null),
  ]);
  const queueCount = (type: string) => queues?.find((q) => q.queue_type === type)?.count ?? null;
  return buildAdministrationDashboard({
    metrics: metrics.filter((m) => m.department === "administration"),
    users: users?.counts ?? null,
    spvBlockers: queueCount("spv_blockers"),
    pendingReviews: queueCount("company_reviews"),
    records: records
      ? { ...records, recentUsers: users?.recent ?? null, inactiveUsers: users?.inactive ?? null, invitedUsers: users?.invitedList ?? null }
      : null,
  });
}
