"use client";

/**
 * Investor reach: Introductions, Automated outreach and Manual outreach as three
 * cards, for one founder company (admin company page, Investor reach tab) or for
 * one investor (admin investor reach page).
 *
 * Toolbar: ⚙ gear (show or hide cards, expand or collapse all, reset, export)
 * and the Odoo search bar, which filters all three cards at once. Each card
 * pages on its own (OdooPager, 10 rows). View opens the actual email sent and
 * the actual reply received.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ToolbarGear, type GearItem } from "@/components/admin/ToolbarGear";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { OdooPager } from "@/components/admin/OdooPager";
import { Highlight, NoSearchMatches } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { PLATFORM_TZ, PLATFORM_TZ_LABEL } from "@/lib/time/platform-tz";
import type { InvestorReach, ReachCard, ReachRow, ReachTone } from "@/lib/admin/investor-reach";
import { InvestorReachViewModal } from "./InvestorReachViewModal";

const PAGE = 10;
const CARDS: Array<{ key: ReachCard; title: string; icon: string }> = [
  { key: "intro", title: "Introductions", icon: "ti-arrows-exchange" },
  { key: "auto", title: "Automated outreach", icon: "ti-robot" },
  { key: "manual", title: "Manual outreach", icon: "ti-mail-forward" },
];
const VIEW_KEY = "icapos.investorReach.view";
type ViewPrefs = { hidden: ReachCard[]; collapsed: ReachCard[] };
const DEFAULT_VIEW: ViewPrefs = { hidden: [], collapsed: [] };

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, month: "short", day: "numeric" });
const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso: string | null) => (iso ? DAY.format(new Date(iso)) : "");
const when = (iso: string | null) => (iso ? `${WHEN.format(new Date(iso))} ${PLATFORM_TZ_LABEL}` : "");

const TONE: Record<ReachTone, string> = {
  good: "bg-emerald-50 text-emerald-800",
  warn: "bg-amber-50 text-amber-800",
  info: "bg-blue-50 text-blue-700",
  bad: "bg-rose-50 text-rose-700",
  muted: "bg-slate-100 text-slate-600",
};
const th = "px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const td = "px-2 py-2 align-top text-[12.5px] text-slate-700";

function readView(): ViewPrefs {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(VIEW_KEY);
    if (!raw) return DEFAULT_VIEW;
    const v = JSON.parse(raw) as Partial<ViewPrefs>;
    return { hidden: Array.isArray(v.hidden) ? v.hidden : [], collapsed: Array.isArray(v.collapsed) ? v.collapsed : [] };
  } catch {
    return DEFAULT_VIEW;
  }
}

const QUICK = [
  { key: "not_opened", label: "Not opened" },
  { key: "opened", label: "Opened" },
  { key: "replied", label: "Replied" },
  { key: "not_sent", label: "Not sent yet", sep: true },
  { key: "last7", label: "Sent last 7 days" },
];
const GROUPS = [
  { id: "", label: "No grouping" },
  { id: "status", label: "Status" },
  { id: "firm", label: "Firm" },
  { id: "company", label: "Founder company" },
];

function quickPass(r: ReachRow, key: string, now: number): boolean {
  switch (key) {
    case "not_opened":
      return Boolean(r.sentAt) && !r.openedAt;
    case "opened":
      return Boolean(r.openedAt);
    case "replied":
      return Boolean(r.repliedAt) || r.status === "Replied";
    case "not_sent":
      return !r.sentAt;
    case "last7":
      return Boolean(r.sentAt) && now - Date.parse(r.sentAt!) <= 7 * 86400000;
    default:
      return true;
  }
}

function groupKey(r: ReachRow, g: string): string {
  if (g === "status") return r.status;
  if (g === "firm") return r.firm || "No firm";
  if (g === "company") return r.companyName || "Unknown company";
  return "";
}

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function InvestorReachPanel({ companyId = null, contactId = null }: Readonly<{ companyId?: string | null; contactId?: string | null }>) {
  const forInvestor = Boolean(contactId);
  const [data, setData] = useState<InvestorReach | null>(null);
  /** When the data loaded: "Sent last 7 days" counts back from here. */
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [view, setView] = useState<ViewPrefs>(readView);
  const [pages, setPages] = useState<Record<ReachCard, number>>({ intro: 0, auto: 0, manual: 0 });
  const [viewing, setViewing] = useState<ReachRow | null>(null);

  useEffect(() => {
    const url = companyId ? `/api/admin/investor-reach?company=${companyId}` : `/api/admin/investor-reach?contact=${contactId}`;
    let live = true;
    fetch(url)
      .then(async (r) => {
        const d = (await r.json().catch(() => null)) as (InvestorReach & { error?: string }) | null;
        if (!live) return;
        if (!r.ok || !d || d.error) setError(d?.error ?? "Could not load investor reach.");
        else {
          setData(d);
          setLoadedAt(Date.now());
        }
      })
      .catch(() => live && setError("Could not load investor reach."));
    return () => {
      live = false;
    };
  }, [companyId, contactId]);

  const saveView = useCallback((next: ViewPrefs) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: the view still works for this visit */
    }
  }, []);

  // Search: every column the cards show.
  const fields: SearchField<ReachRow>[] = useMemo(
    () => [
      { label: forInvestor ? "founder company" : "investor", get: (r) => (forInvestor ? r.companyName : r.name) },
      { label: "firm", get: (r) => r.firm },
      { label: "email", get: (r) => r.email },
      { label: "status", get: (r) => r.status },
      { label: "step", get: (r) => r.step },
      ...(forInvestor ? [{ label: "investor", get: (r: ReachRow) => r.name }] : []),
    ],
    [forInvestor],
  );

  const all = useMemo(() => (data ? [...data.intros, ...data.auto, ...data.manual] : []), [data]);
  const statusOptions = useMemo(() => [...new Set(all.map((r) => r.status))].sort(), [all]);
  const filtered = useMemo(() => {
    const now = loadedAt;
    const chosen = search.fields.status ?? [];
    const pre = all.filter((r) => search.quick.every((k) => quickPass(r, k, now)) && (chosen.length === 0 || chosen.includes(r.status)));
    return matchRows(pre, fields, search.q);
  }, [all, search, fields, loadedAt]);

  // Any search change sends every card back to page 1.
  const onSearch = useCallback((s: SearchState) => {
    setSearch(s);
    setPages({ intro: 0, auto: 0, manual: 0 });
  }, []);

  const byCard = (card: ReachCard) => {
    const rows = filtered.rows.filter((r) => r.card === card);
    if (!search.groupBy) return rows;
    return [...rows].sort((a, b) => groupKey(a, search.groupBy).localeCompare(groupKey(b, search.groupBy)));
  };

  const exportCsv = () => {
    const head = ["Card", "Investor", "Firm", "Email", "Founder company", "Status", "Requested", "Sent", "Delivered", "Opened", "Clicked", "Replied", "Match", "Step"];
    const lines = filtered.rows.map((r) =>
      [CARDS.find((c) => c.key === r.card)?.title, r.name, r.firm, r.email, r.companyName, r.status, r.requestedAt, r.sentAt, r.deliveredAt, r.openedAt, r.clickedAt, r.repliedAt, r.matchScore, r.step].map(csvCell).join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "investor-reach.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const gearItems: GearItem[] = [
    { key: "expand", icon: "ti-arrows-maximize", label: "Expand all", onClick: () => saveView({ ...view, collapsed: [] }) },
    { key: "collapse", icon: "ti-arrows-minimize", label: "Collapse all", onClick: () => saveView({ ...view, collapsed: CARDS.map((c) => c.key) }) },
    { key: "reset", icon: "ti-refresh", label: "Reset view", onClick: () => saveView(DEFAULT_VIEW) },
    { key: "csv", icon: "ti-download", label: "Export to CSV", hint: `${filtered.rows.length} rows`, onClick: exportCsv, sep: true },
  ];

  const gearTop = () => (
    <div className="px-3 py-1.5">
      <div className="pb-1 text-[10px] uppercase tracking-wide text-slate-500">Show cards</div>
      {CARDS.map((c) => {
        const on = !view.hidden.includes(c.key);
        return (
          <label key={c.key} className="flex cursor-pointer items-center gap-2 py-1 text-[12.5px] text-slate-800">
            <input
              type="checkbox"
              checked={on}
              onChange={() => saveView({ ...view, hidden: on ? [...view.hidden, c.key] : view.hidden.filter((h) => h !== c.key) })}
            />
            {c.title}
          </label>
        );
      })}
    </div>
  );

  if (error) return <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  if (!data) return <p className="text-xs text-slate-500">Loading investor reach…</p>;

  const shownCards = CARDS.filter((c) => !view.hidden.includes(c.key));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarGear items={gearItems} top={gearTop} />
        <OdooSearchBar
          scope={forInvestor ? "admin-investor-reach-investor" : "admin-investor-reach-company"}
          state={search}
          onChange={onSearch}
          quick={QUICK}
          fields={[{ key: "status", label: "Status", options: statusOptions }]}
          groups={GROUPS}
          noGroupId=""
          groupChipPrefix="Grouped by "
          placeholder={forInvestor ? "Search founder company, status or email" : "Search investor, firm, email or status"}
          width="min(560px, 100%)"
        />
      </div>
      <p className="text-xs text-slate-500" aria-live="polite">
        {filtered.active || search.quick.length || (search.fields.status ?? []).length ? (
          <>
            <span className="font-semibold tabular-nums text-slate-900">{filtered.rows.length}</span> of {all.length} rows across the cards
            {filtered.matchedFields.length ? ` · matched on ${filtered.matchedFields.slice(0, 2).join(" and ")}` : ""}
          </>
        ) : (
          `${all.length} rows across the cards · times in ${PLATFORM_TZ_LABEL}`
        )}
      </p>

      {filtered.active && filtered.rows.length === 0 ? (
        <NoSearchMatches query={search.q} fields={fields.map((f) => f.label)} onClear={() => onSearch({ ...search, q: "" })} />
      ) : null}

      {shownCards.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">All cards are hidden. Turn them back on from the ⚙ menu.</p>
      ) : null}

      {shownCards.map((c) => {
        const rows = byCard(c.key);
        const total = all.filter((r) => r.card === c.key).length;
        const pages_ = Math.max(1, Math.ceil(rows.length / PAGE));
        const page = Math.min(pages[c.key], pages_ - 1);
        const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
        const collapsed = view.collapsed.includes(c.key);
        const sent = rows.filter((r) => r.sentAt).length;
        const opened = rows.filter((r) => r.openedAt).length;
        const replied = rows.filter((r) => r.repliedAt).length;
        const go = (d: number) => setPages((p) => ({ ...p, [c.key]: (page + d + pages_) % pages_ }));
        const toggle = () => saveView({ ...view, collapsed: collapsed ? view.collapsed.filter((k) => k !== c.key) : [...view.collapsed, c.key] });
        return (
          <section key={c.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <i className={`ti ${collapsed ? "ti-chevron-right" : "ti-chevron-down"} text-slate-500`} aria-hidden="true" />
                <i className={`ti ${c.icon} text-slate-500`} aria-hidden="true" />
                <span className="text-[15px] font-semibold text-slate-900">{c.title}</span>
                <span className="text-xs text-slate-500">
                  {rows.length === total ? `${total}` : `${rows.length} of ${total} shown`} · {sent} sent · {opened} opened{c.key === "manual" ? ` · ${replied} replied` : ""}
                </span>
              </button>
              {rows.length > 0 ? (
                <OdooPager
                  label={`${page * PAGE + 1}–${Math.min(rows.length, page * PAGE + PAGE)} / ${rows.length}`}
                  prev={{ onClick: pages_ > 1 ? () => go(-1) : undefined, disabled: pages_ <= 1 }}
                  next={{ onClick: pages_ > 1 ? () => go(1) : undefined, disabled: pages_ <= 1 }}
                />
              ) : null}
            </div>
            {collapsed ? null : (
              <div className="overflow-x-auto px-4 pb-3">
                {slice.length === 0 ? (
                  <p className="py-3 text-xs text-slate-500">{total === 0 ? emptyText(c.key) : "No rows match the search and filters."}</p>
                ) : (
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className={th}>{forInvestor ? "Founder company" : c.key === "intro" ? "Investor" : "Sent to"}</th>
                        <th className={th}>{c.key === "intro" ? "Requested" : c.key === "auto" ? "Match" : "Step"}</th>
                        <th className={th}>Status</th>
                        <th className={th}>{c.key === "manual" ? "Last sent" : "Sent"}</th>
                        <th className={th}>Delivered</th>
                        <th className={th}>Opened</th>
                        <th className={th}>{c.key === "manual" ? "Replied" : "Clicked"}</th>
                        <th className={th} />
                      </tr>
                    </thead>
                    <tbody>
                      {slice.map((r, i) => {
                        const g = search.groupBy ? groupKey(r, search.groupBy) : "";
                        const prevG = i > 0 && search.groupBy ? groupKey(slice[i - 1], search.groupBy) : null;
                        return (
                          <RowWithGroup key={r.key} group={search.groupBy && g !== prevG ? g : null}>
                            <tr className="border-b border-slate-100">
                              <td className={td}>
                                {forInvestor ? (
                                  <>
                                    <Link href={`/admin/companies/${r.companyId}#reach`} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline">
                                      <Highlight text={r.companyName ?? "Company"} query={search.q} />
                                    </Link>
                                    <div className="text-[11px] text-slate-500">
                                      <Highlight text={r.email ?? ""} query={search.q} />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {r.contactId ? (
                                      <Link href={`/admin/investors/${r.contactId}/reach`} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline">
                                        <Highlight text={r.name} query={search.q} />
                                      </Link>
                                    ) : (
                                      <span className="font-medium text-slate-900">
                                        <Highlight text={r.name} query={search.q} />
                                      </span>
                                    )}
                                    <div className="text-[11px] text-slate-500">
                                      <Highlight text={[r.firm, r.email].filter(Boolean).join(" · ")} query={search.q} />
                                    </div>
                                  </>
                                )}
                                {r.note ? <div className="mt-0.5 text-[11px] text-amber-700">{r.note}</div> : null}
                              </td>
                              <td className={`${td} whitespace-nowrap`}>
                                {c.key === "intro" ? day(r.requestedAt) : c.key === "auto" ? (r.matchScore ?? "") : <Highlight text={r.step ?? ""} query={search.q} />}
                              </td>
                              <td className={td}>
                                <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${TONE[r.statusTone]}`}>
                                  <Highlight text={r.status} query={search.q} />
                                </span>
                              </td>
                              <td className={`${td} whitespace-nowrap`} title={when(r.sentAt)}>
                                {r.sentAt ? day(r.sentAt) : <span className="text-slate-400">{c.key === "auto" && r.status === "Queued" ? "Queued" : "Not sent"}</span>}
                              </td>
                              <td className={`${td} whitespace-nowrap`} title={when(r.deliveredAt)}>
                                {r.bouncedAt ? <Pill tone="bad">Bounced</Pill> : r.deliveredAt ? day(r.deliveredAt) : <span className="text-slate-400">{r.sentAt ? "Unknown" : "n/a"}</span>}
                              </td>
                              <td className={`${td} whitespace-nowrap`} title={when(r.openedAt)}>
                                {r.openedAt ? <Pill tone="good">{day(r.openedAt)}</Pill> : r.sentAt ? <Pill tone="warn">Not yet</Pill> : <span className="text-slate-400">n/a</span>}
                              </td>
                              <td className={`${td} whitespace-nowrap`} title={when(c.key === "manual" ? r.repliedAt : r.clickedAt)}>
                                {c.key === "manual"
                                  ? r.repliedAt ? <Pill tone="good">{day(r.repliedAt)}</Pill> : <span className="text-slate-400">{r.sentAt ? "No" : "n/a"}</span>
                                  : r.clickedAt ? day(r.clickedAt) : <span className="text-slate-400">{r.sentAt ? "No" : "n/a"}</span>}
                              </td>
                              <td className={`${td} text-right`}>
                                {r.mailIds.length || r.repliedAt ? (
                                  <button type="button" onClick={() => setViewing(r)} className="text-[12.5px] font-semibold text-indigo-600 hover:underline">
                                    View
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          </RowWithGroup>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        );
      })}

      {viewing ? <InvestorReachViewModal row={viewing} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

function emptyText(card: ReachCard): string {
  if (card === "intro") return "No introduction requests yet.";
  if (card === "auto") return "No automated outreach yet.";
  return "No manual outreach yet.";
}

function Pill({ tone, children }: Readonly<{ tone: ReachTone; children: React.ReactNode }>) {
  return <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}>{children}</span>;
}

function RowWithGroup({ group, children }: Readonly<{ group: string | null; children: React.ReactNode }>) {
  return (
    <>
      {group !== null ? (
        <tr className="bg-slate-50">
          <td colSpan={8} className="px-2 py-1.5 text-[11.5px] font-semibold text-slate-700">
            {group}
          </td>
        </tr>
      ) : null}
      {children}
    </>
  );
}
