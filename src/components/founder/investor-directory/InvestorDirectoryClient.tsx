"use client";

/**
 * Founder › Investor directory. Search public investor data (not the iCFO Capital
 * network), select rows, import them into Manual outreach. Same toolbar as the
 * other founder lists (FounderToolbar over the Odoo search bar), the Odoo pager,
 * and the selection bar. The search runs on the server.
 *
 * Email and phone show only after import. Before the first import the founder
 * accepts the terms of use (own company's fundraising only, no redistribution).
 */
import { formatPhone } from "@/lib/phone";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FounderToolbar } from "@/components/founder/FounderToolbar";
import { EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { OdooPager } from "@/components/admin/OdooPager";
import { useVocabulary } from "@/lib/vocabulary/provider";
import { DIRECTORY_DISCLAIMER, FORM_D_SOURCE, type DirectoryTier, type FormdPerson, type FounderDirectoryAccess } from "@/lib/investor-directory/types";
import { fmtPT, money } from "@/lib/investor-directory/format";

type Row = {
  id: string; firm: string; contact_name: string | null; title: string | null; email: string | null; phone: string | null;
  website: string | null; city: string | null; state: string | null; investor_types: string[]; funding_stages: string[];
  capital_types: string[]; industries: string[]; fund_name: string | null; fund_size: number | null; avg_investment: number | null;
  strategy: string | null; investing_now: boolean | null; source: string; source_url: string | null; verified_at: string | null;
  held: boolean; hasEmail: boolean; hasPhone: boolean; added_at: string; filed_at: string | null;
  /** Form D firms: people named on the filing (older payloads may omit it). */
  formd_people?: FormdPerson[];
};
type Payload = {
  rows: Row[]; total: number; page: number; pageSize: number; access: FounderDirectoryAccess; tiers: DirectoryTier[];
  settings: { require_terms: boolean; daily_cap: number; allow_export: boolean; terms_version: number };
  facets: { states: string[]; sources: string[] } | null;
  /** What each plan holds (admin editable), for "Limits by plan". */
  plans?: PlanLimit[];
};
type PlanLimit = { planType: string; label: string; contacts: number };

async function fetchDirectory(q: URLSearchParams): Promise<{ ok: true; body: Payload } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/founder/investor-directory?${q}`);
    const body = await res.json();
    if (!res.ok) return { ok: false, error: (body as { error?: string }).error ?? "Couldn't load the directory." };
    return { ok: true, body: body as Payload };
  } catch {
    return { ok: false, error: "Couldn't load the directory." };
  }
}

/** Table columns the founder can show or hide (saved per device). */
type ColKey = "email" | "phone" | "type" | "date" | "source" | "location" | "stage" | "industry" | "fund";
const COLUMNS: { key: ColKey; label: string; on: boolean; width: string }[] = [
  { key: "email", label: "Email", on: true, width: "minmax(150px,1.2fr)" },
  { key: "phone", label: "Phone", on: true, width: "minmax(110px,0.9fr)" },
  { key: "type", label: "Investor type", on: true, width: "minmax(120px,1fr)" },
  { key: "date", label: "Date", on: true, width: "84px" },
  { key: "source", label: "Source", on: true, width: "minmax(96px,0.8fr)" },
  { key: "location", label: "Location", on: false, width: "minmax(110px,0.9fr)" },
  { key: "stage", label: "Stage", on: false, width: "minmax(110px,0.9fr)" },
  { key: "industry", label: "Industry", on: false, width: "minmax(120px,1fr)" },
  { key: "fund", label: "Latest fund", on: false, width: "minmax(120px,1fr)" },
];
const DEFAULT_COLS = COLUMNS.filter((c) => c.on).map((c) => c.key);

function readCols(storageKey: string): ColKey[] {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as string[]) : null;
    const valid = parsed?.filter((k): k is ColKey => COLUMNS.some((c) => c.key === k));
    return valid && valid.length ? valid : DEFAULT_COLS;
  } catch {
    return DEFAULT_COLS;
  }
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

const shortSource = (s: string) => s.replace(/\s*\(.*\)\s*$/, "").replace(/^(SBA|USDA)\b.*$/, "$1");

export function InvestorDirectoryClient({ pinnedSource, onTotal }: Readonly<{ pinnedSource?: string; onTotal?: (total: number) => void }> = {}) {
  const types = useVocabulary("investor_type");
  const stages = useVocabulary("funding_stage");
  const industries = useVocabulary("industry");
  const capital = useVocabulary("capital_type");

  const [search, setSearch] = useState<SearchState>({ ...EMPTY_SEARCH, groupBy: "none" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Payload | null>(null);
  const [facets, setFacets] = useState<{ states: string[]; sources: string[] }>({ states: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [importing, setImporting] = useState(false);
  const [terms, setTerms] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  // Columns: each tab remembers its own picks on this device.
  const colsKey = `icapos.directory.columns.${pinnedSource ? "formd" : "directory"}`;
  const [cols, setCols] = useState<ColKey[]>(() => readCols(colsKey));
  const [colsOpen, setColsOpen] = useState(false);
  const sortRef = useRef<"firm" | "newest">("firm");
  const [sortNewest, setSortNewest] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [capped, setCapped] = useState(false);
  // Form D firms seen in loaded rows or select all results: they don't count toward the limit.
  const [knownFormd, setKnownFormd] = useState<Set<string>>(new Set());

  // Field filters arrive as labels; the API filters on slugs.
  const slugOf = useCallback((opts: { slug: string; label: string }[], labels: string[] | undefined) =>
    (labels ?? []).map((l) => opts.find((o) => o.label === l)?.slug).filter((s): s is string => Boolean(s)), []);

  const buildQuery = useCallback((s: SearchState, p: number, withFacets: boolean, sources: string[]) => {
    const q = new URLSearchParams();
    if (s.q) q.set("q", s.q);
    if (s.quick.includes("investing_now")) q.set("investingNow", "1");
    if (s.quick.includes("has_email")) q.set("hasEmail", "1");
    for (const v of slugOf(types.all, s.fields.type)) q.append("type", v);
    for (const v of slugOf(stages.all, s.fields.stage)) q.append("stage", v);
    for (const v of slugOf(industries.all, s.fields.industry)) q.append("industry", v);
    for (const v of s.fields.state ?? []) q.append("state", v);
    for (const v of s.fields.source ?? []) {
      const full = sources.find((f) => shortSource(f) === v || f === v);
      if (full) q.append("source", full);
    }
    // A pinned source (the Form D tab) always wins over the Source chips.
    if (pinnedSource) { q.delete("source"); q.append("source", pinnedSource); }
    if (p > 1) q.set("page", String(p));
    if (sortRef.current === "newest") q.set("sort", "newest");
    if (withFacets) q.set("facets", "1");
    return q;
  }, [industries.all, pinnedSource, slugOf, stages.all, types.all]);

  const apply = useCallback((result: { ok: true; body: Payload } | { ok: false; error: string }) => {
    if (result.ok) {
      setData(result.body);
      if (result.body.facets) setFacets(result.body.facets);
      setError(null);
    } else setError(result.error);
    setLoading(false);
  }, []);

  const load = useCallback(async (s: SearchState, p: number) => {
    setLoading(true);
    apply(await fetchDirectory(buildQuery(s, p, false, facets.sources)));
  }, [apply, buildQuery, facets.sources]);

  // First load also fetches the filter values (state is set after the fetch resolves).
  useEffect(() => {
    let live = true;
    void fetchDirectory(buildQuery(EMPTY_SEARCH, 1, true, [])).then((r) => { if (live) apply(r); });
    return () => { live = false; };
  }, [apply, buildQuery]);

  function onSearch(next: SearchState) {
    setSearch(next);
    setPage(1);
    setSelected(new Set());
    setCapped(false);
    void load(next, 1);
  }
  function goPage(p: number) {
    setPage(p);
    void load(search, p);
  }

  const access = data?.access;
  const tier = access?.tier;
  const limits = access?.limits;
  const contactLimit = limits?.contacts ?? 0;
  const browseOnly = !access || contactLimit <= 0;
  const selectable = useMemo(() => (data?.rows ?? []).filter((r) => !r.held), [data]);
  const totalRows = data?.total;
  useEffect(() => {
    if (onTotal && totalRows !== undefined) onTotal(totalRows);
  }, [onTotal, totalRows]);

  async function doImport(termsJustAccepted = false) {
    if (!data || !access) return;
    if (browseOnly) { setNotice({ text: "Your plan lets you browse the directory. Basic and up let you add investors. See plans to upgrade.", bad: true }); return; }
    if (data.settings.require_terms && !access.termsAccepted && !termsJustAccepted) { setTerms(true); return; }
    setImporting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/founder/investor-directory/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected] }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.reason === "terms") setTerms(true);
        setNotice({ text: body.error ?? "Couldn't import those investors.", bad: true });
        return;
      }
      const parts = [`${body.imported} investor${body.imported === 1 ? "" : "s"} added to Manual outreach under "From investor directory".`];
      if (body.trimmedBy === "hold_limit") parts.push("The rest didn't fit your contact limit.");
      if (body.trimmedBy === "daily_cap") parts.push(`The rest are over today's limit of ${data.settings.daily_cap.toLocaleString("en-US")}.`);
      if (body.alreadyHeld) parts.push(`${body.alreadyHeld} were already in your list.`);
      setNotice({ text: parts.join(" ") });
      setSelected(new Set());
      await load(search, page);
    } finally {
      setImporting(false);
    }
  }

  async function acceptTerms(agree: boolean) {
    const res = await fetch("/api/founder/investor-directory/terms", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agree }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); return (b as { error?: string }).error ?? "Couldn't save. Try again."; }
    setTerms(false);
    if (data) setData({ ...data, access: { ...data.access, termsAccepted: true, termsAcceptedAt: new Date().toISOString() } });
    return null;
  }

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const grouped = search.groupBy === "type";
  const groups = useMemo(() => {
    if (!grouped) return [{ label: "", rows }];
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const k = r.investor_types[0] ? types.label(r.investor_types[0]) : "Other";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].map(([label, rs]) => ({ label, rows: rs }));
  }, [grouped, rows, types]);

  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 80;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const n = (v: number) => v.toLocaleString("en-US");
  const pct = (used: number, of: number) => (of > 0 ? Math.min(100, Math.round((used / of) * 100)) : 0);
  const heldPct = pct(access?.held ?? 0, contactLimit);
  const emailPct = limits ? pct(limits.emailsUsed, limits.emails) : 0;
  const resets = limits ? new Date(limits.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }) : "";
  const planLine = limits ? `${limits.planLabel} plan` : "";
  // One investor limit for every source, and the next plan up.
  const plans = data?.plans ?? [];
  const myPlan = limits?.allowance.plan_type;
  const nextPlan = limits ? plans.find((pl) => pl.contacts > limits.allowance.contacts) : undefined;
  const heldLeft = access ? Math.max(0, contactLimit - access.held) : 0;
  const nearLimit = !browseOnly && heldPct >= 80;
  const formdTab = pinnedSource === FORM_D_SOURCE;
  // Form D rows are all "SEC Form D", so that tab drops the Source column.
  const visibleCols = COLUMNS.filter((c) => cols.includes(c.key) && !(formdTab && c.key === "source"));
  // The Form D tab adds a fixed Contact column: the person named on the filing.
  const gridCols = `28px minmax(200px,1.6fr) ${formdTab ? "minmax(140px,1fr) " : ""}${visibleCols.map((c) => c.width).join(" ")} 24px`;
  const tableMinWidth = 300 + (visibleCols.length + (formdTab ? 1 : 0)) * 120;
  function toggleCol(k: ColKey) {
    setCols((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
      try { window.localStorage.setItem(colsKey, JSON.stringify(next)); } catch { /* per device only */ }
      return next;
    });
  }
  function resetCols() {
    setCols(DEFAULT_COLS);
    try { window.localStorage.removeItem(colsKey); } catch { /* per device only */ }
  }
  function sortByDate(newest: boolean) {
    sortRef.current = newest ? "newest" : "firm";
    setSortNewest(newest);
    setPage(1);
    void load(search, 1);
  }
  const formdHere = useMemo(() => {
    const s = new Set(knownFormd);
    for (const r of data?.rows ?? []) if (r.source === FORM_D_SOURCE) s.add(r.id);
    return s;
  }, [knownFormd, data]);
  const countedSelected = formdTab ? 0 : [...selected].filter((id) => !formdHere.has(id)).length;
  const overBy = !browseOnly && countedSelected > heldLeft ? countedSelected - heldLeft : 0;
  const upsell = nextPlan ? ` ${nextPlan.label} holds up to ${n(nextPlan.contacts)}.` : "";
  const pageAllSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  // Every match across all pages that isn't held yet, capped at what the plan has left.
  async function selectAllMatching() {
    setSelectingAll(true);
    try {
      const q = buildQuery(search, 1, false, facets.sources);
      q.set("ids", "1");
      const res = await fetch(`/api/founder/investor-directory?${q}`);
      const body = (await res.json().catch(() => ({}))) as { ids?: string[]; formd?: string[]; error?: string };
      if (!res.ok || !body.ids) { setNotice({ text: body.error ?? "Couldn't select every match. Try again.", bad: true }); return; }
      const formd = new Set(body.formd ?? []);
      setKnownFormd((k) => new Set([...k, ...formd]));
      // Form D firms are always selectable; the others stop at what the plan has room for.
      const counted = body.ids.filter((id) => !formd.has(id));
      const keep = new Set(counted.slice(0, Math.max(0, heldLeft)));
      const ids = body.ids.filter((id) => formd.has(id) || keep.has(id));
      setSelected(new Set(ids));
      setCapped(ids.length < body.ids.length);
    } finally {
      setSelectingAll(false);
    }
  }

  function cellText(row: Row, key: ColKey): { text: string; muted?: boolean } {
    switch (key) {
      case "email":
        if (row.held) return row.email ? { text: row.email } : { text: "No email", muted: true };
        if (row.source === FORM_D_SOURCE && !row.hasEmail) return { text: "Not in filing", muted: true };
        return row.hasEmail ? { text: "After import", muted: true } : { text: "No email", muted: true };
      case "phone":
        if (row.held) return row.phone ? { text: row.phone } : { text: "None", muted: true };
        return row.hasPhone ? { text: "After import", muted: true } : { text: "None", muted: true };
      case "type":
        return { text: row.investor_types.map(types.label).join(", ") || "—", muted: row.investor_types.length === 0 };
      case "date":
        return { text: shortDate(row.filed_at ?? row.added_at) };
      case "source":
        return { text: shortSource(row.source) };
      case "location":
        return { text: [row.city, row.state].filter(Boolean).join(", ") || "—", muted: !row.city && !row.state };
      case "stage":
        return { text: row.funding_stages.map(stages.label).join(", ") || "—", muted: row.funding_stages.length === 0 };
      case "industry":
        return { text: row.industries.map(industries.label).join(", ") || "—", muted: row.industries.length === 0 };
      case "fund":
        return { text: row.fund_name ?? "—", muted: !row.fund_name };
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {formdTab ? (
        // Form D tab: no search, just the firm count and the pager.
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
          <span className="text-[13px] font-semibold text-slate-800">{n(total)} firm{total === 1 ? "" : "s"}</span>
          <OdooPager
            label={total === 0 ? "0 / 0" : `${from}-${to} / ${total.toLocaleString("en-US")}`}
            prev={{ onClick: page > 1 ? () => goPage(page - 1) : undefined, disabled: page <= 1 }}
            next={{ onClick: to < total ? () => goPage(page + 1) : undefined, disabled: to >= total }}
          />
        </div>
      ) : (
      <div className="border-b border-slate-100 px-3 py-2.5">
        <FounderToolbar
          scope="investor-directory"
          state={search}
          onChange={onSearch}
          placeholder="Search firm, contact, city, fund…"
          count={total}
          countLabel="investors"
          quick={[
            { key: "investing_now", label: "Investing now" },
            { key: "has_email", label: "Has email" },
          ]}
          fields={[
            { key: "type", label: "Investor type", options: types.options.map((o) => o.label) },
            { key: "stage", label: "Stage", options: stages.options.map((o) => o.label) },
            { key: "industry", label: "Industry", options: industries.options.map((o) => o.label) },
            { key: "state", label: "State", options: facets.states },
            { key: "source", label: "Source", options: facets.sources.map(shortSource) },
          ]}
          groups={[{ id: "none", label: "None" }, { id: "type", label: "Investor type" }]}
          gear={{
            actions: [
              { key: "outreach", label: "Go to Manual outreach", icon: "ti-send", run: () => { window.location.href = "/founder/deploy?step=outreach&mode=manual"; } },
              ...(data?.settings.allow_export && tier?.can_export
                ? [{ key: "export", label: "Export my directory contacts", icon: "ti-download", run: () => { window.location.href = "/api/founder/investor-directory/export"; } }]
                : []),
            ],
          }}
          right={
            <OdooPager
              label={total === 0 ? "0 / 0" : `${from}-${to} / ${total.toLocaleString("en-US")}`}
              prev={{ onClick: page > 1 ? () => goPage(page - 1) : undefined, disabled: page <= 1 }}
              next={{ onClick: to < total ? () => goPage(page + 1) : undefined, disabled: to >= total }}
            />
          }
        />
      </div>
      )}

      {formdTab ? null : (
      <div className="mx-3 mt-3 rounded-lg border border-[#F3DDB3] bg-[#FFF8EC] px-3 py-2 text-[12px] text-[#633806]">
        <b>Not the iCFO Capital investor network.</b> These investors come from public records. iCFO Capital has no relationship with them and does not introduce you. For warm introductions from our network, use Match.
      </div>
      )}

      {access && limits ? (
        browseOnly ? (
          <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[12.5px]">
            <span className="text-slate-600">Your plan lets you browse the directory. Basic and up include directory contacts and Manual outreach emails.</span>
            <Link href="/upgrade" className="ml-auto rounded-lg bg-[#1A6CE4] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#2E78F5]">See plans</Link>
          </div>
        ) : (
          <div className="mx-3 mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">Investors</span>
                <span className="font-medium tabular-nums text-slate-800">{n(access.held)} / {n(contactLimit)}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white">
                <div className={`h-1.5 rounded-full ${heldPct >= 100 ? "bg-[#A32D2D]" : heldPct >= 80 ? "bg-[#B7791F]" : "bg-[#1A6CE4]"}`} style={{ width: `${heldPct}%` }} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11.5px] text-slate-500">
                <span>
                  {planLine}
                  {access.formdUncounted > 0 ? ` · + ${n(access.formdUncounted)} Form D firm${access.formdUncounted === 1 ? "" : "s"}, not counted` : ""}
                  {access.status !== "active" ? ` · ${access.status === "paused" ? "Imports paused" : "Access suspended"}` : ""}
                </span>
                <span className="flex-1" />
                {plans.length > 0 ? (
                  <button type="button" onClick={() => setShowPlans((v) => !v)} aria-expanded={showPlans} className="font-medium text-[#185FA5] hover:underline">
                    Limits by plan <i className={`ti ${showPlans ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
                  </button>
                ) : null}
                {nextPlan ? <Link href="/upgrade" className="font-medium text-[#185FA5] hover:underline">Upgrade</Link> : null}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">Emails this period</span>
                <span className="font-medium tabular-nums text-slate-800">{n(limits.emailsUsed)} / {n(limits.emails)}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white">
                <div className={`h-1.5 rounded-full ${emailPct >= 100 ? "bg-[#A32D2D]" : emailPct >= 80 ? "bg-[#B7791F]" : "bg-[#1A6CE4]"}`} style={{ width: `${emailPct}%` }} />
              </div>
              <div className={`mt-1 text-[11.5px] ${emailPct >= 80 ? "text-[#8A5300]" : "text-slate-500"}`}>Resets {resets}</div>
            </div>
          </div>
        )
      ) : null}

      {limits && showPlans && plans.length > 0 ? (
        <div className="mx-3 mt-2 grid gap-2 sm:grid-cols-4">
          {plans.map((pl) => (
            <div key={pl.planType} className={`rounded-lg px-3 py-2 ${pl.planType === myPlan ? "border-2 border-[#1A6CE4] bg-white" : "border border-slate-200 bg-slate-50"}`}>
              <div className="text-[10.5px] uppercase tracking-wide text-slate-500">{pl.label}{pl.planType === myPlan ? " · your plan" : ""}</div>
              <div className="text-[15px] font-semibold text-slate-900">{pl.contacts > 0 ? `Up to ${n(pl.contacts)}` : "Locked"}</div>
              <div className="text-[11.5px] text-slate-500">{pl.contacts > 0 ? "investors, all sources" : "Adding investors not included"}</div>
            </div>
          ))}
        </div>
      ) : null}

      {access && limits && nearLimit ? (
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#FFF8EC] px-3 py-2 text-[12.5px] text-[#633806]">
          <span className="min-w-0 flex-1">
            {heldLeft <= 0
              ? `You hold ${n(access.held)} of ${n(contactLimit)} investors, the most your plan allows.${upsell}`
              : `You hold ${n(access.held)} of ${n(contactLimit)} investors on ${limits.planLabel}.${upsell}`}
          </span>
          <Link href="/upgrade" className="font-semibold underline">Upgrade</Link>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2.5 border-y border-[#B5D4F4] bg-[#E6F1FB] px-3 py-2">
          <span className="rounded-md bg-[#B5D4F4] px-2.5 py-1 text-[12.5px] font-semibold text-[#0C447C]">{selected.size} selected</span>
          {total > selected.size && !browseOnly && !capped ? (
            <button type="button" disabled={selectingAll} onClick={() => void selectAllMatching()} className="text-[12.5px] text-[#185FA5] disabled:opacity-60">
              <i className="ti ti-arrow-right" aria-hidden="true" /> {selectingAll ? "Selecting…" : `Select all ${n(total)} matching`}
            </button>
          ) : null}
          {capped ? <span className="text-[12px] text-[#8A5300]">The first {n(selected.size)}, all your plan has room for</span> : null}
          <button type="button" aria-label="Clear selection" onClick={() => { setSelected(new Set()); setCapped(false); }} className="text-[#185FA5]"><i className="ti ti-x" aria-hidden="true" /></button>
          <button type="button" disabled={importing || overBy > 0} onClick={() => void doImport()} className="ml-auto rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-60">
            <i className="ti ti-download" aria-hidden="true" /> {importing ? "Importing…" : "Import to outreach"}
          </button>
        </div>
      ) : null}

      {limits && overBy > 0 ? (
        <div className="mx-3 mt-2 rounded-md bg-[#FCEBEB] px-3 py-2 text-[12.5px] text-[#791F1F]">
          {heldLeft <= 0
            ? `${limits.planLabel} holds up to ${n(contactLimit)} investors and you have none left.`
            : `${limits.planLabel} holds up to ${n(contactLimit)} investors and you have ${n(heldLeft)} left. Untick ${n(overBy)}.`}
          {nextPlan ? <> Or <Link href="/upgrade" className="font-semibold underline">move to {nextPlan.label}</Link> for up to {n(nextPlan.contacts)}.</> : null}
        </div>
      ) : null}

      {notice ? (
        <div className={`mx-3 mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-[12.5px] ${notice.bad ? "bg-[#FCEBEB] text-[#791F1F]" : "bg-[#EAF3DE] text-[#27500A]"}`}>
          <span className="flex-1">{notice.text}{!notice.bad ? <> <Link href="/founder/deploy?step=outreach&mode=manual" className="font-semibold underline">Open Manual outreach</Link></> : null}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
      ) : null}

      <div className="relative mt-3">
        {colsOpen ? (
          <div className="absolute right-3 top-8 z-20 w-52 rounded-lg border border-slate-200 bg-white p-2 text-[12.5px] shadow-lg">
            <p className="px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Columns</p>
            {COLUMNS.filter((c) => !(formdTab && c.key === "source")).map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50">
                <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} className="h-3.5 w-3.5" />
                {c.key === "date" ? (formdTab ? "Filing date" : "Date added") : c.label}
              </label>
            ))}
            <div className="mt-1 flex justify-between border-t border-slate-100 px-1 pt-1.5">
              <button type="button" onClick={resetCols} className="text-[12px] text-[#185FA5] hover:underline">Reset to default</button>
              <button type="button" onClick={() => setColsOpen(false)} className="text-[12px] text-slate-500 hover:text-slate-800">Done</button>
            </div>
          </div>
        ) : null}
        <div className="overflow-x-auto">
        <div style={{ minWidth: tableMinWidth }}>
        {!error && rows.length > 0 ? (
          <div className="grid items-center gap-3 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11.5px] font-medium text-slate-500" style={{ gridTemplateColumns: gridCols }}>
            {selectable.length > 0 ? (
              <input
                type="checkbox"
                aria-label={`Select all on this page (${n(selectable.length)})`}
                title={`Select all on this page (${n(selectable.length)})`}
                checked={pageAllSelected}
                onChange={() => setSelected((s) => {
                  const next = new Set(s);
                  if (pageAllSelected) for (const r of selectable) next.delete(r.id);
                  else for (const r of selectable) next.add(r.id);
                  return next;
                })}
                className="h-4 w-4"
              />
            ) : <span />}
            <span>{formdTab ? "Firm" : "Firm / contact"}</span>
            {formdTab ? <span>Contact</span> : null}
            {visibleCols.map((c) => c.key === "date" ? (
              formdTab ? <span key={c.key}>Filed</span> : (
                <button key={c.key} type="button" onClick={() => sortByDate(!sortNewest)} className="text-left font-medium hover:text-slate-800" title={sortNewest ? "Sort by firm name" : "Sort newest first"}>
                  Added {sortNewest ? <i className="ti ti-arrow-down" aria-hidden="true" /> : null}
                </button>
              )
            ) : <span key={c.key}>{c.label}</span>)}
            <button type="button" onClick={() => setColsOpen((v) => !v)} aria-expanded={colsOpen} aria-label="Choose columns" className="text-center text-slate-500 hover:text-slate-800">
              <i className="ti ti-dots-vertical" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {error ? <p className="px-4 py-10 text-center text-sm text-[#A32D2D]">{error}</p>
          : loading && !data ? <p className="px-4 py-10 text-center text-sm text-slate-500">Loading the directory…</p>
          : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              {search.q || search.quick.length || Object.values(search.fields).some((v) => v.length)
                ? "No investors match. Searched firm, contact, city, state and fund. Clear a filter to see more."
                : "The directory is being prepared. Check back soon."}
            </p>
          ) : groups.map((g) => (
            <div key={g.label || "all"}>
              {grouped ? (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700">
                  {g.label}<span className="rounded-md bg-[#E6F1FB] px-2 text-[11px] text-[#0C447C]">{g.rows.length}</span>
                </div>
              ) : null}
              {g.rows.map((r) => {
                const isOpen = open === r.id;
                return (
                  <div key={r.id} className="border-b border-slate-100">
                    <div className="grid cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50" style={{ gridTemplateColumns: gridCols }} onClick={() => setOpen(isOpen ? null : r.id)}>
                      {r.held ? (
                        <i className="ti ti-check w-4 text-center text-[#27500A]" aria-label="In your outreach" />
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.firm}`}
                          checked={selected.has(r.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-slate-900">{r.firm}</div>
                        <div className="truncate text-[12px] text-slate-500">
                          {[r.contact_name, cols.includes("location") ? null : [r.city, r.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {formdTab ? (() => {
                        const first = r.formd_people?.[0];
                        if (!first) return <span className="truncate text-[12.5px] text-slate-400">No person on file</span>;
                        const more = (r.formd_people?.length ?? 0) - 1;
                        return (
                          <div className="min-w-0">
                            <div className="truncate text-[12.5px] text-slate-800" title={first.name}>{first.name}{more > 0 ? <span className="text-slate-400"> +{more}</span> : null}</div>
                            {first.role ? <div className="truncate text-[11px] text-slate-500" title={first.role}>{first.role}</div> : null}
                          </div>
                        );
                      })() : null}
                      {visibleCols.map((c) => {
                        if (c.key === "source") {
                          return r.held
                            ? <span key={c.key}><span className="rounded-md bg-[#EAF3DE] px-2 py-0.5 text-[11px] text-[#27500A]">In outreach</span></span>
                            : <span key={c.key} className="truncate"><span className="rounded-md bg-[#E6F1FB] px-2 py-0.5 text-[11px] text-[#0C447C]">{shortSource(r.source)}</span></span>;
                        }
                        const v = cellText(r, c.key);
                        return <span key={c.key} className={`truncate text-[12.5px] ${c.key === "date" || c.key === "phone" ? "tabular-nums " : ""}${v.muted ? "text-slate-400" : "text-slate-700"}`} title={v.text}>{v.text}</span>;
                      })}
                      <i className={`ti ti-chevron-${isOpen ? "up" : "down"} text-center text-slate-400`} aria-hidden="true" />
                    </div>
                    {isOpen ? (
                      <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-1 bg-slate-50 px-3 pb-3 pl-10 pt-1 text-[12.5px]">
                        <span className="text-slate-500">Contact</span><span>{r.contact_name ?? "—"}{r.title ? `, ${r.title}` : ""}</span>
                        <span className="text-slate-500">Email</span><span>{r.held ? (r.email ?? "Not published") : r.hasEmail ? "Published, shown after import" : "Not published"}</span>
                        <span className="text-slate-500">Phone</span><span>{r.held ? (r.phone ? formatPhone(r.phone) : "Not published") : r.hasPhone ? "Published, shown after import" : "Not published"}</span>
                        <span className="text-slate-500">Invests in</span>
                        <span>{[...r.investor_types.map(types.label), ...r.funding_stages.map(stages.label), ...r.capital_types.map(capital.label), ...r.industries.map(industries.label)].join(" · ") || "—"}</span>
                        {r.fund_name ? <><span className="text-slate-500">Latest fund</span><span>{r.fund_name}{r.fund_size ? ` · ${money(r.fund_size)}` : ""}{r.avg_investment ? ` · avg check ${money(r.avg_investment)}` : ""}</span></> : null}
                        {r.investing_now !== null ? <><span className="text-slate-500">Investing now</span><span>{r.investing_now ? "Yes" : "No"}</span></> : null}
                        <span className="text-slate-500">Source</span>
                        <span>{r.source_url ? <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-[#1A6CE4]">{r.source}</a> : r.source}</span>
                        <span className="text-slate-500">Verified</span><span>{r.verified_at ? fmtPT(r.verified_at) : "Not yet verified by iCFO"}</span>
                        {r.source === FORM_D_SOURCE ? <FormdProfile people={r.formd_people ?? []} held={r.held} /> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        </div>
      </div>

      <p className="px-3 py-3 text-[11.5px] text-slate-500">{DIRECTORY_DISCLAIMER} For your own company&apos;s fundraising only.</p>

      {terms ? <TermsDialog onClose={() => setTerms(false)} onAccept={acceptTerms} onAccepted={() => void doImport(true)} /> : null}
    </div>
  );
}

/** People named on a Form D firm's filing, with what the fund is raising. */
function FormdProfile({ people, held }: Readonly<{ people: FormdPerson[]; held: boolean }>) {
  const chips = (v: string[]) => (v.length ? v.join(", ") : "—");
  return (
    <div className="col-span-2 mt-2 border-t border-slate-200 pt-2">
      <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Form D profile</p>
      {people.length === 0 ? (
        <p className="text-slate-500">No person on file for this firm&apos;s filings.</p>
      ) : people.map((p) => (
        <div key={p.name} className="mb-2 grid grid-cols-[150px_minmax(0,1fr)] gap-x-3 gap-y-0.5">
          <span className="text-slate-500">Contact</span><span className="font-medium">{p.name}{p.role ? <span className="font-normal text-slate-600">, {p.role}</span> : null}</span>
          <span className="text-slate-500">Phone</span><span>{held ? (p.phone ? formatPhone(p.phone) : "Not in filing") : p.hasPhone ? "On the filing, shown after import" : "Not in filing"}</span>
          <span className="text-slate-500">Email</span><span className="text-slate-500">Not in filing</span>
          <span className="text-slate-500">Fund industry (SEC)</span><span>{chips(p.industries)}</span>
          <span className="text-slate-500">Raising at stage</span><span>{chips(p.stages)}</span>
          <span className="text-slate-500">Raising amount</span><span>{chips(p.amounts)}</span>
          <span className="text-slate-500">Raising from</span><span>{chips(p.raisingFrom)}</span>
        </div>
      ))}
      {people.length ? <p className="text-[11px] text-slate-500">From the fund&apos;s own Form D filing: what the fund is raising, not what it invests in.</p> : null}
    </div>
  );
}

function TermsDialog({ onClose, onAccept, onAccepted }: Readonly<{ onClose: () => void; onAccept: (agree: boolean) => Promise<string | null>; onAccepted: () => void }>) {
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!agree) { setError("Check the box to continue."); return; }
    setBusy(true);
    const err = await onAccept(true);
    setBusy(false);
    if (err) { setError(err); return; }
    onAccepted();
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Investor directory terms of use" className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 text-[13px] leading-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2"><i className="ti ti-file-certificate text-[20px] text-[#1A6CE4]" aria-hidden="true" /><h2 className="text-[16px] font-semibold text-slate-900">Investor directory terms of use</h2></div>
        <p className="mb-2">Before you import, please confirm how you&apos;ll use this data.</p>
        <p className="font-semibold">Your own use only</p>
        <p className="mb-2 text-slate-600">Directory data is licensed to you for your own company&apos;s fundraising outreach. It&apos;s not for use on behalf of other companies or clients.</p>
        <p className="font-semibold">No redistribution</p>
        <p className="mb-2 text-slate-600">You may not sell, share, publish, or transfer directory data, in whole or in part, to anyone outside your account. That includes exporting it into lists, databases, or tools used by others.</p>
        <p className="font-semibold">Respectful outreach</p>
        <p className="mb-2 text-slate-600">Contact investors one to one about your raise. Honor every request to stop. Bulk or automated mailing outside iCapOS isn&apos;t allowed.</p>
        <p className="font-semibold">Not the iCFO Capital investor network</p>
        <p className="mb-2 text-slate-600">This data comes from public sources. iCFO Capital has no relationship with these investors, does not introduce you to them, and doesn&apos;t guarantee accuracy. iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only.</p>
        <p className="font-semibold">Monitoring and enforcement</p>
        <p className="mb-3 text-slate-600">iCFO monitors imports and sends. Misuse can lead to paused imports, suspended access, or account termination without refund.</p>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => { setAgree(e.target.checked); setError(null); }} />
          <span>I agree to use directory data for my own company&apos;s fundraising only and not to redistribute it.</span>
        </label>
        {error ? <p className="mt-2 text-[#A32D2D]">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">Cancel</button>
          <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5]">{busy ? "Saving…" : "Agree and import"}</button>
        </div>
      </div>
    </div>
  );
}
