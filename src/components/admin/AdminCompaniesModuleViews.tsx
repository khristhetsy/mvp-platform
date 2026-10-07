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
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
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
  const filtered = search.rows;

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
    return { paying, mrr: formatMonthly(mrrCents, currency).replace("/mo", ""), free, pending };
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
      <AdminQueryFilterBar page="companies" className="mb-4" />
      <div className="mb-4 flex flex-wrap items-center gap-3 justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("companies.searchPh")}
          className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <select
          value={userType}
          onChange={(e) => setUserType(e.target.value as UserType)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          aria-label="Filter by user type"
        >
          <option value="">All users</option>
          <option value="founders">Founders</option>
          <option value="investors">Investors</option>
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          aria-label="Filter by journey stage"
        >
          <option value="">All stages</option>
          <option value="initialize">Onboarding</option>
          <option value="qualify">Preparation</option>
          <option value="deploy">Marketing</option>
          <option value="optimize">Closing</option>
          <option value="pending">⏳ Awaiting my approval</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          aria-label="Filter by plan"
        >
          <option value="">All plans</option>
          <option value="professional">Professional</option>
          <option value="basic">Basic</option>
          <option value="managed_ir">{PLAN_LABELS.founder_managed_ir}</option>
          <option value="free">Free (legacy)</option>
          <option value="pending">Payment pending</option>
          <option value="none">No plan or internal</option>
        </select>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["kanban", "grid", "list", "journey"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-white text-slate-950 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v === "kanban" ? t("companies.kanban") : v === "grid" ? t("companies.grid") : v === "list" ? t("companies.list") : "Journey"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ["Paying", String(planTotals.paying)],
          ["MRR", planTotals.mrr],
          ["Free (legacy)", String(planTotals.free)],
          ["Payment pending", String(planTotals.pending)],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

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
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">{t("companies.colCompany")}</th>
                  <th className="px-4 py-3">{t("companies.colFounder")}</th>
                  <th className="px-4 py-3">{t("companies.colIndustry")}</th>
                  {([["readiness", "Readiness"], ["investable", "Investable"], ["stage", "Stage"], ["plan", "Plan"], ["signed_on", "Signed on"], ["window", "Current window"], ["reached", "Reached / limit"], ["outreach", "Outreach status"], ["intros", "Intro requests"]] as const).map(([key, label]) => (
                    <th key={key} className="px-4 py-3">
                      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
                        {label}
                        <span className="text-[9px]">{sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3">{t("companies.colReview")}</th>
                  <th className="px-4 py-3">{t("companies.colPublished")}</th>
                  <th className="px-4 py-3">{t("companies.colAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listRows.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => { window.location.href = `/admin/companies/${company.id}`; }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900"><Highlight text={company.company_name} query={query} /></td>
                    <td className="px-4 py-3 text-slate-600"><Highlight text={company.founder_name} query={query} /></td>
                    <td className="px-4 py-3 text-slate-500">{company.industry ? <Highlight text={company.industry} query={query} /> : "—"}</td>
                    <td className={`px-4 py-3 ${scoreClass(company.readiness_score)}`}>
                      {company.readiness_score != null ? company.readiness_score : "—"}
                    </td>
                    <td className={`px-4 py-3 ${scoreClass(company.investable_score)}`}>
                      {company.investable_score != null ? company.investable_score : "—"}
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    {(() => {
                      const plan = planView(company);
                      return (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${plan.cls}`}>{plan.label}</span>
                          {plan.amount && <div className="mt-1 text-xs font-semibold text-slate-900">{plan.amount}</div>}
                          {plan.note && <div className="text-[10px] text-slate-400">{plan.note}</div>}
                        </td>
                      );
                    })()}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {company.founder_signed_on_at ? (
                        <>
                          <div className="text-xs text-slate-700">{formatShortDate(company.founder_signed_on_at)}</div>
                          <div className="text-[10px] text-slate-400">{timeAgo(company.founder_signed_on_at)}</div>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <AllowanceCells allowance={allowances[company.id]} />
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        company.review_status === "approved"
                          ? "bg-emerald-50 text-emerald-800"
                          : company.review_status === "rejected"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-800"
                      }`}>
                        {reviewStatusLabel(t, company.review_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {company.is_published ? t("companies.published") : t("companies.draft")}
                    </td>
                    <td className="px-4 py-3">
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

const OUTREACH_ORDER: Record<CompanyAllowance["status"], number> = { stalled: 0, behind: 1, on_pace: 2, full: 3 };
const OUTREACH_STYLE: Record<CompanyAllowance["status"], { label: string; cls: string; bar: string }> = {
  full: { label: "Full", cls: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  on_pace: { label: "On pace", cls: "bg-blue-50 text-blue-700", bar: "bg-blue-500" },
  behind: { label: "Behind pace", cls: "bg-amber-50 text-amber-800", bar: "bg-amber-500" },
  stalled: { label: "Stalled", cls: "bg-red-50 text-red-700", bar: "bg-red-400" },
};
const shortUtc = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Current window, reached / limit, outreach status and intro requests for one company (paid founders only). */
function AllowanceCells({ allowance: a }: { allowance: CompanyAllowance | undefined }) {
  const dash = <span className="text-slate-400">—</span>;
  if (!a) {
    return (
      <>
        <td className="px-4 py-3">{dash}</td>
        <td className="px-4 py-3">{dash}</td>
        <td className="px-4 py-3">{dash}</td>
        <td className="px-4 py-3">{dash}</td>
      </>
    );
  }
  const st = OUTREACH_STYLE[a.status];
  const pct = a.cap ? Math.min(100, Math.round((a.reached / a.cap) * 100)) : 100;
  return (
    <>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-xs text-slate-700">{shortUtc(a.windowStart)} to {shortUtc(a.windowEnd)}</div>
        <div className="text-[10px] text-slate-400">Day {a.day} of 30</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-xs font-semibold text-slate-900">{a.reached} / {a.cap ?? "no limit"}</div>
        {a.cap ? (
          <div className="mt-1 h-1 w-16 rounded bg-slate-100"><div className={`h-1 rounded ${st.bar}`} style={{ width: `${pct}%` }} /></div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${st.cls}`}>{st.label}</span>
        <div className="mt-1 text-[10px] text-slate-400">{a.note}</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {a.intros ? <div className="text-xs text-slate-700">{a.intros.used} / {a.intros.cap}</div> : dash}
      </td>
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
