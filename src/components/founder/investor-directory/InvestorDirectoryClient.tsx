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
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FounderToolbar } from "@/components/founder/FounderToolbar";
import { EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { OdooPager } from "@/components/admin/OdooPager";
import { useVocabulary } from "@/lib/vocabulary/provider";
import { DIRECTORY_DISCLAIMER, type DirectoryTier, type FounderDirectoryAccess } from "@/lib/investor-directory/types";
import { fmtPT, money } from "@/lib/investor-directory/format";

type Row = {
  id: string; firm: string; contact_name: string | null; title: string | null; email: string | null; phone: string | null;
  website: string | null; city: string | null; state: string | null; investor_types: string[]; funding_stages: string[];
  capital_types: string[]; industries: string[]; fund_name: string | null; fund_size: number | null; avg_investment: number | null;
  strategy: string | null; investing_now: boolean | null; source: string; source_url: string | null; verified_at: string | null;
  held: boolean; hasEmail: boolean; hasPhone: boolean;
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
  const emailsLeft = limits ? Math.max(0, limits.emails - limits.emailsUsed) : 0;
  const resets = limits ? new Date(limits.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }) : "";
  const planLine = limits ? `${limits.planLabel} plan` : "";
  // One investor limit for every source, and the next plan up.
  const plans = data?.plans ?? [];
  const myPlan = limits?.allowance.plan_type;
  const nextPlan = limits ? plans.find((pl) => pl.contacts > limits.allowance.contacts) : undefined;
  const heldLeft = access ? Math.max(0, contactLimit - access.held) : 0;
  const nearLimit = !browseOnly && heldPct >= 80;
  const overBy = !browseOnly && selected.size > heldLeft ? selected.size - heldLeft : 0;
  const holdsLine = limits ? `${limits.planLabel} holds up to ${n(limits.allowance.contacts)} investors` : "";
  const upsell = nextPlan ? ` ${nextPlan.label} holds up to ${n(nextPlan.contacts)}.` : "";

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
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

      <div className="mx-3 mt-3 rounded-lg border border-[#F3DDB3] bg-[#FFF8EC] px-3 py-2 text-[12px] text-[#633806]">
        <b>Not the iCFO Capital investor network.</b> These investors come from public records. iCFO Capital has no relationship with them and does not introduce you. For warm introductions from our network, use Match.
      </div>

      {access && limits ? (
        browseOnly ? (
          <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[12.5px]">
            <span className="text-slate-600">Your plan lets you browse the directory. Basic and up include directory contacts and Manual outreach emails.</span>
            <Link href="/upgrade" className="ml-auto rounded-lg bg-[#1A6CE4] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#2E78F5]">See plans</Link>
          </div>
        ) : (
          <div className="mx-3 mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">Investors held</span>
                <span className="text-slate-800">{n(access.held)} of {n(contactLimit)}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white">
                <div className={`h-1.5 rounded-full ${heldPct >= 100 ? "bg-[#A32D2D]" : heldPct >= 80 ? "bg-[#B7791F]" : "bg-[#1A6CE4]"}`} style={{ width: `${heldPct}%` }} />
              </div>
              <div className={`mt-1 text-[11.5px] ${heldPct >= 80 ? "text-[#8A5300]" : "text-slate-500"}`}>
                All sources · {planLine} · {n(heldLeft)} left · {holdsLine}
                {access.status !== "active" ? ` · ${access.status === "paused" ? "Imports paused" : "Access suspended"}` : ""}
              </div>
              {plans.length > 0 ? (
                <button type="button" onClick={() => setShowPlans((v) => !v)} aria-expanded={showPlans} className="mt-1 text-[11.5px] font-medium text-[#185FA5] hover:underline">
                  Limits by plan <i className={`ti ${showPlans ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">Manual outreach emails</span>
                <span className="text-slate-800">{n(limits.emailsUsed)} of {n(limits.emails)}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white">
                <div className={`h-1.5 rounded-full ${emailPct >= 100 ? "bg-[#A32D2D]" : emailPct >= 80 ? "bg-[#B7791F]" : "bg-[#1A6CE4]"}`} style={{ width: `${emailPct}%` }} />
              </div>
              <div className={`mt-1 text-[11.5px] ${emailPct >= 80 ? "text-[#8A5300]" : "text-slate-500"}`}>{n(emailsLeft)} left · resets {resets} PT</div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium text-slate-800">Need more?</div>
                <div className="text-[11.5px] text-slate-500">
                  {nextPlan ? `${nextPlan.label} holds up to ${n(nextPlan.contacts)} investors` : `${limits.planLabel} holds up to ${n(limits.allowance.contacts)} investors`}
                </div>
              </div>
              {nextPlan ? (
                <Link href="/upgrade" className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#2E78F5]">Upgrade</Link>
              ) : null}
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
          {selected.size < selectable.length ? (
            <button type="button" onClick={() => setSelected(new Set(selectable.map((r) => r.id)))} className="text-[12.5px] text-[#185FA5]">
              <i className="ti ti-arrow-right" aria-hidden="true" /> Select all {selectable.length}
            </button>
          ) : null}
          <button type="button" aria-label="Clear selection" onClick={() => setSelected(new Set())} className="text-[#185FA5]"><i className="ti ti-x" aria-hidden="true" /></button>
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

      <div className="mt-3">
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
                    <div className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50" onClick={() => setOpen(isOpen ? null : r.id)}>
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
                          {[r.contact_name, r.funding_stages.map(stages.label).join(", ") || r.strategy, [r.city, r.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {r.held
                        ? <span className="rounded-md bg-[#EAF3DE] px-2 py-0.5 text-[11px] text-[#27500A]">In outreach</span>
                        : <span className="rounded-md bg-[#E6F1FB] px-2 py-0.5 text-[11px] text-[#0C447C]">{shortSource(r.source)}</span>}
                      <i className={`ti ti-chevron-${isOpen ? "up" : "down"} text-slate-400`} aria-hidden="true" />
                    </div>
                    {isOpen ? (
                      <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-1 bg-slate-50 px-3 pb-3 pl-10 pt-1 text-[12.5px]">
                        <span className="text-slate-500">Contact</span><span>{r.contact_name ?? "—"}{r.title ? `, ${r.title}` : ""}</span>
                        <span className="text-slate-500">Email</span><span>{r.held ? (r.email ?? "Not published") : r.hasEmail ? "Published, shown after import" : "Not published"}</span>
                        <span className="text-slate-500">Phone</span><span>{r.held ? (r.phone ?? "Not published") : r.hasPhone ? "Published, shown after import" : "Not published"}</span>
                        <span className="text-slate-500">Invests in</span>
                        <span>{[...r.investor_types.map(types.label), ...r.funding_stages.map(stages.label), ...r.capital_types.map(capital.label), ...r.industries.map(industries.label)].join(" · ") || "—"}</span>
                        {r.fund_name ? <><span className="text-slate-500">Latest fund</span><span>{r.fund_name}{r.fund_size ? ` · ${money(r.fund_size)}` : ""}{r.avg_investment ? ` · avg check ${money(r.avg_investment)}` : ""}</span></> : null}
                        {r.investing_now !== null ? <><span className="text-slate-500">Investing now</span><span>{r.investing_now ? "Yes" : "No"}</span></> : null}
                        <span className="text-slate-500">Source</span>
                        <span>{r.source_url ? <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-[#1A6CE4]">{r.source}</a> : r.source}</span>
                        <span className="text-slate-500">Verified</span><span>{r.verified_at ? fmtPT(r.verified_at) : "Not yet verified by iCFO"}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
      </div>

      <p className="px-3 py-3 text-[11.5px] text-slate-500">{DIRECTORY_DISCLAIMER} For your own company&apos;s fundraising only.</p>

      {terms ? <TermsDialog onClose={() => setTerms(false)} onAccept={acceptTerms} onAccepted={() => void doImport(true)} /> : null}
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
