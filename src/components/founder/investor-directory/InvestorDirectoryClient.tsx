"use client";

/**
 * Founder › Investor directory. Search public investor data (outside the iCFO
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
};

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

export function InvestorDirectoryClient() {
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
  const [upgrade, setUpgrade] = useState(false);

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
    if (p > 1) q.set("page", String(p));
    if (withFacets) q.set("facets", "1");
    return q;
  }, [industries.all, slugOf, stages.all, types.all]);

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
  const browseOnly = !tier || tier.hold_limit <= 0;
  const selectable = useMemo(() => (data?.rows ?? []).filter((r) => !r.held), [data]);

  async function doImport(termsJustAccepted = false) {
    if (!data || !access) return;
    if (browseOnly) { setUpgrade(true); return; }
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
        else if (body.reason === "hold_limit" || body.reason === "free_plan") setUpgrade(true);
        setNotice({ text: body.error ?? "Couldn't import those investors.", bad: true });
        return;
      }
      const parts = [`${body.imported} investor${body.imported === 1 ? "" : "s"} added to Manual outreach under "From investor directory".`];
      if (body.trimmedBy === "hold_limit") parts.push("The rest didn't fit your plan's contact space.");
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
  const heldPct = tier && tier.hold_limit > 0 ? Math.min(100, Math.round(((access?.held ?? 0) / tier.hold_limit) * 100)) : 0;

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

      {access ? (
        <div className="mx-3 mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
          {browseOnly ? (
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="text-slate-600">Your plan lets you browse the directory. Holding directory contacts needs a directory plan.</span>
              <button type="button" onClick={() => setUpgrade(true)} className="ml-auto rounded-lg bg-[#1A6CE4] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#2E78F5]">See plans</button>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">Contacts held</span>
                <span className="text-slate-800">{access.held.toLocaleString("en-US")} of {tier!.hold_limit.toLocaleString("en-US")}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white">
                <div className="h-1.5 rounded-full bg-[#1A6CE4]" style={{ width: `${heldPct}%` }} />
              </div>
              <div className="mt-1 flex items-center text-[11.5px] text-slate-500">
                <span>{tier!.label}{access.status !== "active" ? ` · ${access.status === "paused" ? "Imports paused" : "Access suspended"}` : ""}</span>
                <button type="button" onClick={() => setUpgrade(true)} className="ml-auto text-[#1A6CE4]">More space</button>
              </div>
            </>
          )}
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
          <button type="button" disabled={importing} onClick={() => void doImport()} className="ml-auto rounded-lg bg-[#1A6CE4] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-60">
            <i className="ti ti-download" aria-hidden="true" /> {importing ? "Importing…" : "Import to outreach"}
          </button>
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
      {upgrade && data ? <UpgradeDialog tiers={data.tiers} current={tier?.key ?? "free"} onClose={() => setUpgrade(false)} /> : null}
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
        <p className="font-semibold">Outside the iCFO network</p>
        <p className="mb-2 text-slate-600">This data comes from public sources. iCFO has no relationship with these investors and doesn&apos;t guarantee accuracy. iCFO does not solicit securities and is not an investment adviser. Content is for educational purposes only.</p>
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

function UpgradeDialog({ tiers, current, onClose }: Readonly<{ tiers: DirectoryTier[]; current: string; onClose: () => void }>) {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function request(key: string) {
    setError(null);
    const res = await fetch("/api/founder/investor-directory/upgrade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: key }) });
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError((b as { error?: string }).error ?? "Couldn't send your request."); return; }
    setSent(key);
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Directory plans" className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 text-[13px]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[16px] font-semibold text-slate-900">Directory contact space</h2>
        <p className="mt-1 text-slate-600">Plans set how many directory contacts you can hold in your outreach at once. Browsing stays free.</p>
        <div className="mt-3 space-y-2">
          {tiers.map((t) => (
            <div key={t.key} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${t.key === current ? "border-[#378ADD] bg-[#E6F1FB]" : "border-slate-200"}`}>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">{t.label}</div>
                <div className="text-[12px] text-slate-500">Hold up to {t.hold_limit.toLocaleString("en-US")} contacts{t.can_export ? " · export included" : ""}</div>
              </div>
              {t.price_cents !== null ? <span className="text-[12.5px] text-slate-700">${(t.price_cents / 100).toLocaleString("en-US")}/mo</span> : null}
              {t.key === current ? <span className="text-[12px] text-[#0C447C]">Current</span>
                : sent === t.key ? <span className="text-[12px] text-[#27500A]">Requested</span>
                : <button type="button" onClick={() => void request(t.key)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-[12px] hover:bg-slate-50">Request</button>}
            </div>
          ))}
        </div>
        {sent ? <p className="mt-3 text-[#27500A]">Request sent. iCFO will confirm your plan by email.</p> : null}
        {error ? <p className="mt-3 text-[#A32D2D]">{error}</p> : null}
        <div className="mt-4 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px]">Close</button></div>
      </div>
    </div>
  );
}
