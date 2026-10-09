"use client";

import { Suspense, useMemo, useState } from "react";
import type { CompanyAllowance } from "@/lib/outreach/company-allowances";
import { useTranslations } from "next-intl";
import { AdminCompanyCard } from "@/components/AdminCompanyCard";
import type { AdminCompanyCardData } from "@/components/AdminCompanyCard";
import { AdminQueryFilterBar } from "@/components/ui/AdminQueryFilterBar";
import { ModuleEmptyState, PipelineBoard } from "@/components/ui/ViewToolbar";
import { PageSection } from "@/components/ui/workspace-layout";
import { useAdminQueryFilters } from "@/hooks/use-admin-query-filters";
import { filterCompanies as applyCompanyQueryFilters, type CompanyQueryFilters } from "@/lib/ui/query-filters";
import { matchRows, searchSummary, type SearchField } from "@/lib/ui/live-search";
import { Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";
import { PLAN_LABELS, PLAN_PRICES } from "@/lib/subscriptions/plans";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState, type QuickFilter, type GroupOption } from "@/components/admin/OdooSearchBar";
import { CompaniesGear } from "@/components/admin/companies/CompaniesGear";
import { CompaniesPlanDonut, type PlanSlice, type PlanSliceKey } from "@/components/admin/companies/CompaniesPlanDonut";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

type ViewMode = "kanban" | "grid" | "list" | "journey";
type UserType = "" | "founders" | "investors";
type T = (key: string, values?: Record<string, string | number>) => string;

const STAGE_ORDER = ["initialize", "qualify", "deploy", "optimize"];
const STAGE_STYLE: Record<string, string> = {
  initialize: "bg-slate-100 text-slate-600",
  qualify: "bg-blue-50 text-blue-800",
  deploy: "bg-indigo-50 text-indigo-800",
  optimize: "bg-emerald-50 text-emerald-800",
};
// Display the founder's Stage 1–4 vocabulary; engine slugs stay the filter values.
const STAGE_LABEL: Record<string, string> = {
  initialize: "Onboarding",
  qualify: "Preparation",
  deploy: "Marketing",
  optimize: "Closing",
};
function scoreClass(n: number | null | undefined) {
  if (n == null) return "text-slate-400";
  if (n >= 70) return "text-emerald-700 font-semibold";
  if (n >= 50) return "text-amber-700 font-semibold";
  return "text-red-600 font-semibold";
}

// Journey-view status chip derived from the approval + review signals already on
// the card (no new query). Mirrors the Journey-view mock.
function journeyStatus(c: AdminCompanyCardData): { label: string; cls: string } {
  if (c.stage_approval_status === "pending") return { label: "Awaiting approval", cls: "bg-indigo-50 text-indigo-700" };
  if (c.stage_approval_status === "rejected" || c.review_status === "rejected") return { label: "Rejected", cls: "bg-red-50 text-red-700" };
  if (c.review_status === "approved") return { label: "On track", cls: "bg-emerald-50 text-emerald-700" };
  return { label: "In progress", cls: "bg-slate-100 text-slate-600" };
}

// Plan column: which plan the founder is on and what they pay per month, read
// from the subscription already loaded on each card (no new query).
type PlanFilter = "" | "professional" | "basic" | "managed_ir" | "free" | "pending" | "none";
type PlanView = {
  label: string;
  cls: string;
  amount: string | null;
  note: string | null;
  cents: number;
  group: Exclude<PlanFilter, "">;
};

function formatMonthly(cents: number, currency: string | null | undefined) {
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
  return cents > 0 ? `${amount}/mo` : amount;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.round((days / 30) * 2) / 2;
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function planView(c: AdminCompanyCardData): PlanView {
  const sub = c.founder_subscription;
  if (!sub) {
    return { label: "No plan", cls: "bg-slate-50 text-slate-400 border border-slate-200", amount: null, note: null, cents: -1, group: "none" };
  }
  const cents = sub.monthly_price_cents ?? 0;
  const amount = formatMonthly(cents, sub.currency);
  if (sub.plan_type === "admin_internal") {
    return { label: "Internal", cls: "bg-slate-100 text-slate-600", amount, note: null, cents, group: "none" };
  }
  if (sub.plan_type === "founder_free" || sub.plan_type === "founder_trial") {
    return { label: "Free (legacy)", cls: "bg-slate-100 text-slate-600", amount, note: null, cents, group: "free" };
  }
  const name = PLAN_LABELS[sub.plan_type] ?? sub.plan_type;
  const group: PlanView["group"] =
    sub.plan_type === "founder_professional" ? "professional"
    : sub.plan_type === "founder_basic" ? "basic"
    : sub.plan_type === "founder_managed_ir" ? "managed_ir"
    : "none";
  if (sub.subscription_status === "pending_payment") {
    return { label: `${name}, pending`, cls: "bg-amber-50 text-amber-800", amount, note: "Not paid yet", cents, group: "pending" };
  }
  const cls = sub.plan_type === "founder_basic" ? "bg-emerald-50 text-emerald-800" : "bg-indigo-50 text-indigo-800";
  if (sub.subscription_status === "canceled" || sub.subscription_status === "expired") {
    return { label: name, cls: "bg-slate-100 text-slate-600", amount, note: sub.subscription_status === "canceled" ? "Canceled" : "Expired", cents, group };
  }
  if (cents === 0 && (PLAN_PRICES[sub.plan_type] ?? 0) > 0) {
    return { label: name, cls, amount, note: "Comped", cents, group };
  }
  const note = sub.is_grandfathered && sub.current_period_start ? `Billing since ${formatShortDate(sub.current_period_start).replace(/, \d{4}$/, "")}` : null;
  return { label: name, cls, amount, note, cents, group };
}

function isPaying(c: AdminCompanyCardData) {
  const sub = c.founder_subscription;
  return Boolean(sub && sub.subscription_status === "active" && sub.plan_type !== "admin_internal" && (sub.monthly_price_cents ?? 0) > 0);
}

/** One slice of the plan circle graph per founder account. */
function accountCategory(c: AdminCompanyCardData): PlanSliceKey {
  const sub = c.founder_subscription;
  if (isPaying(c)) return "paying";
  if (sub?.subscription_status === "pending_payment") return "pending";
  if (sub && (sub.plan_type === "founder_free" || sub.plan_type === "founder_trial")) return "free";
  return "other";
}

const SLICE_META: Record<PlanSliceKey, { label: string; color: string }> = {
  paying: { label: "Paying", color: "#1D9E75" },
  free: { label: "Free (legacy)", color: "#B4B2A9" },
  pending: { label: "Payment pending", color: "#EF9F27" },
  other: { label: "Internal, comped or no plan", color: "#CBD5E1" },
};

const COMPANY_QUICK: QuickFilter[] = [
  { key: "awaiting", label: "Awaiting my approval" },
  { key: "review", label: "Pending review" },
  { key: "published", label: "Published", sep: true },
  { key: "draft", label: "Draft" },
  { key: "ready", label: "Readiness 70 or more", sep: true },
  { key: "outreach_stalled", label: "Outreach stalled" },
];

const COMPANY_GROUPS: GroupOption[] = [
  { id: "none", label: "No grouping" },
  { id: "stage", label: "Stage" },
  { id: "plan", label: "Plan" },
  { id: "industry", label: "Industry" },
];

function reviewStatusLabel(t: T, status: string | null) {
  if (status === "pending" || status === "approved" || status === "rejected") return t(`companies.reviewStatus.${status}`);
  return t("companies.reviewStatus.unknown");
}

// Every column the table shows is searchable — the old version covered four
// fields, so typing a stage, a score or a founder's email found nothing even
// though those values were on screen.
const COMPANY_SEARCH_FIELDS: SearchField<AdminCompanyCardData>[] = [
  { label: "company name", get: (c) => c.company_name },
  { label: "founder", get: (c) => c.founder_name },
  { label: "founder email", get: (c) => c.founder_email },
  { label: "industry", get: (c) => c.industry },
  { label: "stage", get: (c) => c.journey_stage },
  { label: "review status", get: (c) => c.review_status },
  { label: "readiness", get: (c) => c.readiness_score },
  { label: "CRR", get: (c) => c.investable_score },
];

const COMPANY_SEARCH_LABELS = COMPANY_SEARCH_FIELDS.map((f) => f.label);

function AdminCompaniesModuleViewsInner({
  companies,
  loadError,
  pendingCount,
  allowances = {},
}: Readonly<{
  companies: AdminCompanyCardData[];
  loadError: string | null;
  pendingCount: number;
  allowances?: Record<string, CompanyAllowance>;
}>) {
  const t = useTranslations("billingCompaniesAdmin");
  const [searchState, setSearchState] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "none" });
  const query = searchState.q;
  const setQuery = (q: string) => setSearchState((st) => ({ ...st, q }));
  const [slice, setSlice] = useState<PlanSliceKey | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  // Show columns picker (same pattern as Contacts): choice remembered on this browser.
  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(COLS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : DEFAULT_COLS;
    } catch { return DEFAULT_COLS; }
  });
  const [colsOpen, setColsOpen] = useState(false);
  const show = (key: ColKey) => ALWAYS_COLS.has(key) || visibleCols.includes(key);
  function saveCols(next: string[]) {
    setVisibleCols(next);
    try { window.localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function toggleCol(key: ColKey) {
    saveCols(visibleCols.includes(key) ? visibleCols.filter((k) => k !== key) : [...visibleCols, key]);
  }
  const colLabel = (key: ColKey): string => ({
    company: t("companies.colCompany"), founder: t("companies.colFounder"), industry: t("companies.colIndustry"),
    review: t("companies.colReview"), published: t("companies.colPublished"), action: t("companies.colAction"),
  } as Partial<Record<ColKey, string>>)[key] ?? SORT_LABEL[key as SortCol] ?? key;
  const visibleCount = ALL_COLS.filter(show).length;
  const [userType, setUserType] = useState<UserType>("");
  const { filters } = useAdminQueryFilters("companies");
  const companyFilters = filters as CompanyQueryFilters;

  const drilldownFiltered = useMemo(
    () => applyCompanyQueryFilters(companies, { ...companyFilters, q: "" }),
    [companies, companyFilters],
  );

  const search = useMemo(
    () => matchRows(drilldownFiltered, COMPANY_SEARCH_FIELDS, query),
    [drilldownFiltered, query],
  );
  // Search bar quick filters, industry field and the circle graph slice.
  const industries = useMemo(
    () => [...new Set(companies.map((c) => c.industry).filter((v): v is string => Boolean(v)))].sort(),
    [companies],
  );
  const filtered = useMemo(() => {
    const quick = new Set(searchState.quick);
    const inds = searchState.fields.industry ?? [];
    return search.rows.filter((c) => {
      if (slice && accountCategory(c) !== slice) return false;
      if (inds.length && !inds.includes(c.industry ?? "")) return false;
      if (quick.has("awaiting") && c.stage_approval_status !== "pending") return false;
      if (quick.has("review") && c.review_status !== "pending") return false;
      if (quick.has("published") && !c.is_published) return false;
      if (quick.has("draft") && c.is_published) return false;
      if (quick.has("ready") && !((c.readiness_score ?? 0) >= 70)) return false;
      if (quick.has("outreach_stalled") && allowances[c.id]?.status !== "stalled") return false;
      return true;
    });
  }, [search.rows, slice, searchState.quick, searchState.fields, allowances]);

  // Journey-stage filter + sortable score/stage columns (list view).
  const [stageFilter, setStageFilter] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("");
  const [sortKey, setSortKey] = useState<"readiness" | "investable" | "stage" | "plan" | "signed_on" | "window" | "reached" | "outreach" | "intros" | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  function toggleSort(key: "readiness" | "investable" | "stage" | "plan" | "signed_on" | "window" | "reached" | "outreach" | "intros") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }
  const listRows = useMemo(() => {
    let rows = filtered;
    if (stageFilter === "pending") rows = rows.filter((c) => c.stage_approval_status === "pending");
    else if (stageFilter) rows = rows.filter((c) => (c.journey_stage ?? "") === stageFilter);
    if (planFilter) rows = rows.filter((c) => planView(c).group === planFilter);
    if (sortKey) {
      const val = (c: AdminCompanyCardData) =>
        sortKey === "stage"
          ? (c.journey_stage ? STAGE_ORDER.indexOf(c.journey_stage) : -1)
          : sortKey === "plan"
          ? planView(c).cents
          : sortKey === "signed_on"
          ? (c.founder_signed_on_at ? new Date(c.founder_signed_on_at).getTime() : -1)
          : sortKey === "window"
          ? (allowances[c.id] ? new Date(allowances[c.id].windowEnd).getTime() : -1)
          : sortKey === "reached"
          ? (allowances[c.id] ? (allowances[c.id].cap ? allowances[c.id].reached / (allowances[c.id].cap as number) : 1) : -1)
          : sortKey === "outreach"
          ? (allowances[c.id] ? OUTREACH_ORDER[allowances[c.id].status] : -1)
          : sortKey === "intros"
          ? (allowances[c.id]?.intros ? allowances[c.id].intros!.used : -1)
          : (sortKey === "readiness" ? c.readiness_score : c.investable_score) ?? -1;
      rows = [...rows].sort((a, b) => (sortDir === "asc" ? val(a) - val(b) : val(b) - val(a)));
    }
    return rows;
  }, [filtered, stageFilter, planFilter, sortKey, sortDir, allowances]);

  // Plan summary tiles. Counted per founder subscription so a founder with two
  // companies is not counted (or billed) twice.
  const planTotals = useMemo(() => {
    const seen = new Set<string>();
    let paying = 0, mrrCents = 0, free = 0, pending = 0;
    let currency = "usd";
    for (const c of companies) {
      const sub = c.founder_subscription;
      if (!sub || seen.has(sub.id)) continue;
      seen.add(sub.id);
      if (isPaying(c)) { paying += 1; mrrCents += sub.monthly_price_cents ?? 0; currency = sub.currency || currency; }
      if (sub.plan_type === "founder_free" || sub.plan_type === "founder_trial") free += 1;
      if (sub.subscription_status === "pending_payment") pending += 1;
    }
    // One count per founder account (a founder with two companies counts once).
    const accounts = new Map<string, PlanSliceKey>();
    for (const c of companies) {
      const key = c.founder_subscription?.id ?? (c.founder_email ? `e:${c.founder_email.toLowerCase()}` : c.id);
      if (!accounts.has(key)) accounts.set(key, accountCategory(c));
    }
    const count = (k: PlanSliceKey) => [...accounts.values()].filter((v) => v === k).length;
    const slices: PlanSlice[] = (["paying", "free", "pending", "other"] as const).map((k) => ({ key: k, ...SLICE_META[k], count: count(k) }));
    return { paying, mrr: formatMonthly(mrrCents, currency).replace("/mo", ""), free, pending, slices };
  }, [companies]);

  const pipelineColumns = useMemo(() => {
    const byStatus = new Map<string, AdminCompanyCardData[]>();
    for (const company of filtered) {
      const key = company.review_status ?? "unknown";
      const list = byStatus.get(key) ?? [];
      list.push(company);
      byStatus.set(key, list);
    }
    const order = ["pending", "approved", "rejected", "unknown"];
    const keys = [...new Set([...order, ...byStatus.keys()])].filter((k) => byStatus.has(k));
    return keys.map((status) => ({
      id: status,
      title: reviewStatusLabel(t, status === "unknown" ? null : status),
      items: (byStatus.get(status) ?? []).map((company) => (
        <AdminCompanyCard key={company.id} company={company} />
      )),
    }));
  }, [filtered, t]);

  return (
    <>
      <CompaniesPlanDonut slices={planTotals.slices} mrr={planTotals.mrr} active={slice} onSelect={setSlice} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CompaniesGear
          sections={[
            {
              title: "Users",
              value: userType,
              onChange: (v) => setUserType(v as UserType),
              options: [{ value: "", label: "All users" }, { value: "founders", label: "Founders" }, { value: "investors", label: "Investors" }],
            },
            {
              title: "Stage",
              value: stageFilter,
              onChange: setStageFilter,
              options: [
                { value: "", label: "All stages" },
                { value: "initialize", label: "Onboarding" },
                { value: "qualify", label: "Preparation" },
                { value: "deploy", label: "Marketing" },
                { value: "optimize", label: "Closing" },
                { value: "pending", label: "Awaiting my approval" },
              ],
            },
            {
              title: "Plan",
              value: planFilter,
              onChange: (v) => setPlanFilter(v as PlanFilter),
              options: [
                { value: "", label: "All plans" },
                { value: "professional", label: "Professional" },
                { value: "basic", label: "Basic" },
                { value: "managed_ir", label: PLAN_LABELS.founder_managed_ir },
                { value: "free", label: "Free (legacy)" },
                { value: "pending", label: "Payment pending" },
                { value: "none", label: "No plan or internal" },
              ],
            },
            {
              title: "View",
              value: view,
              onChange: (v) => setView(v as ViewMode),
              options: [
                { value: "kanban", label: t("companies.kanban") },
                { value: "grid", label: t("companies.grid") },
                { value: "list", label: t("companies.list") },
                { value: "journey", label: "Journey" },
              ],
            },
          ]}
        />
        <div className="min-w-0 flex-1">
          <OdooSearchBar
            scope="admin_companies"
            state={searchState}
            onChange={setSearchState}
            quick={COMPANY_QUICK}
            fields={[{ key: "industry", label: "Industry", options: industries }]}
            groups={COMPANY_GROUPS}
            noGroupId="none"
            placeholder={t("companies.searchPh")}
            width="100%"
          />
        </div>
        {view === "list" ? (
          <div className="relative shrink-0">
            <button type="button" onClick={() => setColsOpen((v) => !v)} aria-expanded={colsOpen} style={{ fontSize: 12, color: "var(--foreground)", background: "transparent", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i className="ti ti-columns-3" style={{ fontSize: 15 }} aria-hidden="true" /> Columns
            </button>
            {colsOpen ? (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, width: 200, background: "#fff", border: "0.5px solid var(--border-strong, #cbd5e1)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 8 }}>
                <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: ".04em", padding: "2px 4px 6px" }}>Show columns</div>
                {ALL_COLS.map((key) => {
                  const always = ALWAYS_COLS.has(key);
                  return (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", fontSize: 12, cursor: always ? "default" : "pointer", opacity: always ? 0.55 : 1 }}>
                      <input type="checkbox" checked={show(key)} disabled={always} onChange={() => toggleCol(key)} style={{ width: 14, height: 14 }} />
                      {colLabel(key)}
                    </label>
                  );
                })}
                <button type="button" onClick={() => saveCols(DEFAULT_COLS)} style={{ width: "100%", textAlign: "left", marginTop: 4, padding: "6px 4px 2px", borderTop: "0.5px solid #eef1f5", fontSize: 11.5, color: "#2E78F5", background: "none", cursor: "pointer" }}>Reset to default</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <AdminQueryFilterBar page="companies" className="mb-4" />

      <PageSection
        title={t("companies.submissions")}
        subtitle={`${searchSummary(search, "companies")} · ${pendingCount} pending review`}
      >
        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            {t("companies.loadFailed", { error: loadError })}
          </div>
        ) : companies.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            {t("companies.zeroRecords")}
          </div>
        ) : userType === "investors" ? (
          <ModuleEmptyState
            title="Investor accounts live in the Investors directory"
            description="This list is company-centric. Open Directory → Investors to browse and filter investor accounts."
          />
        ) : filtered.length === 0 ? (
          search.active ? (
            <NoSearchMatches query={query} fields={COMPANY_SEARCH_LABELS} onClear={() => setQuery("")} />
          ) : (
            <ModuleEmptyState title={t("companies.noMatching")} description={t("companies.noMatchingDesc")} />
          )
        ) : view === "journey" ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {listRows.map((company) => {
                const idx = company.journey_stage ? STAGE_ORDER.indexOf(company.journey_stage) : -1;
                const status = journeyStatus(company);
                return (
                  <li
                    key={company.id}
                    className="grid cursor-pointer grid-cols-[1.5fr_1.6fr_0.8fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50"
                    onClick={() => { window.location.href = `/admin/companies/${company.id}`; }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900"><Highlight text={company.company_name} query={query} /></p>
                      <p className="truncate text-xs text-slate-500"><Highlight text={company.founder_name} query={query} /></p>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-1">
                        {STAGE_ORDER.map((s, i) => (
                          <div
                            key={s}
                            title={STAGE_LABEL[s]}
                            className={`h-1.5 flex-1 rounded ${i <= idx ? "bg-indigo-500" : "bg-slate-200"}`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {idx >= 0 ? `Stage ${idx + 1} · ${STAGE_LABEL[STAGE_ORDER[idx]]}` : "Not started"}
                      </p>
                    </div>
                    <div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
                      <p className={`mt-0.5 text-[11px] ${scoreClass(company.readiness_score)}`}>
                        {company.readiness_score != null ? `${company.readiness_score}% ready` : "—"}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-indigo-600">Open →</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : view === "kanban" ? (
          <PipelineBoard columns={pipelineColumns} density="comfortable" />
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((company) => (
              <AdminCompanyCard key={company.id} company={company} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:align-middle">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <th className="px-3 py-2.5">{t("companies.colCompany")}</th>
                  {show("founder") && <th className="px-3 py-2.5">{t("companies.colFounder")}</th>}
                  {show("industry") && <th className="px-3 py-2.5">{t("companies.colIndustry")}</th>}
                  {SORT_COLS.filter(show).map((key) => [key, SORT_LABEL[key]] as const).map(([key, label]) => (
                    <th key={key} className={`px-3 py-2.5 ${NUMERIC_COLS.has(key) ? "text-right" : ""}`}>
                      <button type="button" onClick={() => toggleSort(key)} className={`inline-flex items-center gap-1 hover:text-slate-800 ${NUMERIC_COLS.has(key) ? "flex-row-reverse" : ""}`}>
                        {label}
                        <span className="text-[9px]">{sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
                      </button>
                    </th>
                  ))}
                  {show("review") && <th className="px-3 py-2.5">{t("companies.colReview")}</th>}
                  {show("published") && <th className="px-3 py-2.5">{t("companies.colPublished")}</th>}
                  <th className="px-3 py-2.5">{t("companies.colAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupRows(listRows, searchState.groupBy).map(({ header, count, company }) => header ? (
                  <tr key={`g:${header}`} className="bg-slate-50">
                    <td colSpan={visibleCount} className="px-3 py-2 text-xs font-semibold text-slate-700">
                      {header} <span className="font-normal text-slate-400">({count})</span>
                    </td>
                  </tr>
                ) : company && (
                  <tr
                    key={company.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => { window.location.href = `/admin/companies/${company.id}`; }}
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap"><Highlight text={company.company_name} query={query} /></td>
                    {show("founder") && <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap"><Highlight text={company.founder_name} query={query} /></td>}
                    {show("industry") && <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{company.industry ? <Highlight text={company.industry} query={query} /> : "—"}</td>}
                    {show("readiness") && <td className={`px-3 py-2.5 text-right tabular-nums ${scoreClass(company.readiness_score)}`}>
                      {company.readiness_score != null ? company.readiness_score : "—"}
                    </td>}
                    {show("investable") && <td className={`px-3 py-2.5 text-right tabular-nums ${scoreClass(company.investable_score)}`}>
                      {company.investable_score != null ? company.investable_score : "—"}
                    </td>}
                    {show("stage") && <td className="px-3 py-2.5 whitespace-nowrap">
                      {company.journey_stage ? (
                        <span className="inline-flex items-center gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STAGE_STYLE[company.journey_stage] ?? "bg-slate-100 text-slate-600"}`}>
                            {STAGE_LABEL[company.journey_stage] ?? company.journey_stage}
                          </span>
                          {company.stage_approval_status === "pending" && <span className="text-[10px] text-amber-700" title="Awaiting your approval">⏳</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>}
                    {show("plan") && (() => {
                      const plan = planView(company);
                      return (
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${plan.cls}`}>{plan.label}</span>
                          {plan.amount && <div className="mt-1 text-xs font-semibold text-slate-900">{plan.amount}</div>}
                          {plan.note && <div className="text-[10px] text-slate-400">{plan.note}</div>}
                        </td>
                      );
                    })()}
                    {show("signed_on") && <td className="px-3 py-2.5 whitespace-nowrap">
                      {company.founder_signed_on_at ? (
                        <>
                          <div className="text-xs text-slate-700">{formatShortDate(company.founder_signed_on_at)}</div>
                          <div className="text-[10px] text-slate-400">{timeAgo(company.founder_signed_on_at)}</div>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>}
                    <AllowanceCells allowance={allowances[company.id]} show={show} companyId={company.id} />
                    {show("review") && <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        company.review_status === "approved"
                          ? "bg-emerald-50 text-emerald-800"
                          : company.review_status === "rejected"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-800"
                      }`}>
                        {reviewStatusLabel(t, company.review_status)}
                      </span>
                    </td>}
                    {show("published") && <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {company.is_published ? t("companies.published") : t("companies.draft")}
                    </td>}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {company.review_status === "pending" ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/admin/companies/${company.id}`; }}
                            className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700"
                          >
                            {t("companies.approve")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); window.location.href = `/admin/companies/${company.id}`; }}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {t("companies.review")}
                          </button>
                        )}
                        <span className="text-xs text-indigo-600">→</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </>
  );
}

/** Number columns are right aligned so values stack by digit. */
const NUMERIC_COLS = new Set<string>(["readiness", "investable", "reached", "intros"]);
/** List columns in display order: company, founder, industry, 9 sortable, review, published, action. */
type SortCol = "readiness" | "investable" | "stage" | "plan" | "signed_on" | "window" | "reached" | "outreach" | "intros";
type ColKey = "company" | "founder" | "industry" | SortCol | "review" | "published" | "action";
const SORT_COLS: SortCol[] = ["readiness", "investable", "stage", "plan", "signed_on", "window", "reached", "outreach", "intros"];
const SORT_LABEL: Record<SortCol, string> = {
  readiness: "Readiness", investable: "Investable", stage: "Stage", plan: "Plan", signed_on: "Signed on",
  window: "Current window", reached: "Reached / limit", outreach: "Outreach status", intros: "Intro requests",
};
const ALL_COLS: ColKey[] = ["company", "founder", "industry", ...SORT_COLS, "review", "published", "action"];
/** Company identifies the row and Action holds Approve / Review, so neither can be hidden. */
const ALWAYS_COLS = new Set<ColKey>(["company", "action"]);
const DEFAULT_COLS: string[] = [...ALL_COLS];
const COLS_STORAGE_KEY = "adminCompanies.cols.v1";

/** List rows with a header row before each group (Group by in the search bar). */
function groupRows(rows: AdminCompanyCardData[], groupBy: string): Array<{ header?: string; count?: number; company?: AdminCompanyCardData }> {
  if (!groupBy || groupBy === "none") return rows.map((company) => ({ company }));
  const keyOf = (c: AdminCompanyCardData) =>
    groupBy === "stage" ? (c.journey_stage ? STAGE_LABEL[c.journey_stage] ?? c.journey_stage : "No stage")
    : groupBy === "plan" ? planView(c).label
    : c.industry || "No industry";
  const groups = new Map<string, AdminCompanyCardData[]>();
  for (const c of rows) {
    const k = keyOf(c);
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const out: Array<{ header?: string; count?: number; company?: AdminCompanyCardData }> = [];
  for (const [header, list] of groups) {
    out.push({ header, count: list.length });
    for (const company of list) out.push({ company });
  }
  return out;
}

const OUTREACH_ORDER: Record<CompanyAllowance["status"], number> = { stalled: 0, behind: 1, on_pace: 2, full: 3 };
const OUTREACH_STYLE: Record<CompanyAllowance["status"], { label: string; cls: string; bar: string }> = {
  full: { label: "Full", cls: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  on_pace: { label: "On pace", cls: "bg-blue-50 text-blue-700", bar: "bg-blue-500" },
  behind: { label: "Behind pace", cls: "bg-amber-50 text-amber-800", bar: "bg-amber-500" },
  stalled: { label: "Stalled", cls: "bg-red-50 text-red-700", bar: "bg-red-400" },
};
const shortUtc = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PLATFORM_TZ });

/** Current window, reached / limit, outreach status and intro requests for one company (paid founders only). */
function AllowanceCells({ allowance: a, show, companyId }: { allowance: CompanyAllowance | undefined; show: (key: ColKey) => boolean; companyId: string }) {
  // Outreach status and intro requests open the company's Investor reach tab.
  const reach = `/admin/companies/${companyId}#reach`;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const dash = <span className="text-slate-400">—</span>;
  if (!a) {
    return (
      <>
        {show("window") && <td className="px-3 py-2.5 whitespace-nowrap">{dash}</td>}
        {show("reached") && <td className="px-3 py-2.5 whitespace-nowrap">{dash}</td>}
        {show("outreach") && <td className="px-3 py-2.5 whitespace-nowrap">{dash}</td>}
        {show("intros") && <td className="px-3 py-2.5 whitespace-nowrap">{dash}</td>}
      </>
    );
  }
  const st = OUTREACH_STYLE[a.status];
  const pct = a.cap ? Math.min(100, Math.round((a.reached / a.cap) * 100)) : 100;
  return (
    <>
      {show("window") && <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="text-xs text-slate-700">{shortUtc(a.windowStart)} to {shortUtc(a.windowEnd)}</div>
        <div className="text-[10px] text-slate-400">Day {a.day} of 30</div>
      </td>}
      {show("reached") && <td className="px-3 py-2.5 whitespace-nowrap text-right">
        <div className="text-xs font-semibold tabular-nums text-slate-900">{a.reached} / {a.cap ?? "no limit"}</div>
        {a.cap ? (
          <div className="ml-auto mt-1 h-1 w-16 rounded bg-slate-100"><div className={`h-1 rounded ${st.bar}`} style={{ width: `${pct}%` }} /></div>
        ) : null}
      </td>}
      {show("outreach") && <td className="px-3 py-2.5 whitespace-nowrap">
        <a href={reach} onClick={stop} title="Open Investor reach" className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap hover:underline ${st.cls}`}>{st.label}</a>
        <div className="mt-1 text-[10px] text-slate-400">{a.note}</div>
      </td>}
      {show("intros") && <td className="px-3 py-2.5 whitespace-nowrap text-right">
        {a.intros ? <a href={reach} onClick={stop} title="Open Investor reach" className="text-xs tabular-nums text-slate-700 hover:text-indigo-600 hover:underline">{a.intros.used} / {a.intros.cap}</a> : dash}
      </td>}
    </>
  );
}

export function AdminCompaniesModuleViews(
  props: Readonly<{
    companies: AdminCompanyCardData[];
    loadError: string | null;
    pendingCount: number;
    allowances?: Record<string, CompanyAllowance>;
  }>,
) {
  return (
    <Suspense fallback={<CompaniesLoadingFallback />}>
      <AdminCompaniesModuleViewsInner {...props} />
    </Suspense>
  );
}

function CompaniesLoadingFallback() {
  const t = useTranslations("billingCompaniesAdmin");
  return <p className="text-sm text-slate-500">{t("companies.loadingView")}</p>;
}
