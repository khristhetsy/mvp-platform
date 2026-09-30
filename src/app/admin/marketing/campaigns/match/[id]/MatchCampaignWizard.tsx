"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MetricCard } from "@/components/MetricCard";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { SelectionBar } from "@/components/admin/sales/SelectionBar";
import { Highlight } from "@/components/ui/SearchStatus";
import type { MatchCampaign, CampaignCounts, CampaignFounderRow, AdminMatchRow } from "@/lib/match-campaigns/service";
import type { MatchResults } from "@/lib/match-campaigns/results";
import { EXCLUDED_LABEL, SOURCE_FILTER_LABELS, SOURCE_KEYS, type SourceKey, type SourceTag, type ExcludedReason } from "@/lib/match-campaigns/core";

// ── Shared look (brand colours, the approved mockup) ──────────────────────────
const C = { navy: "#0A1A40", blue: "#1A6CE4", hover: "#2E78F5", steel: "#185FA5", line: "#E3E7EF", muted: "#6B7488", ok: "#1F9D63", warn: "#C98A12", bad: "#C0392B", chip: "#EAF1FD" };
const card: React.CSSProperties = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 18, marginBottom: 14 };
const h2: React.CSSProperties = { fontFamily: "Archivo, sans-serif", fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: C.navy };
const sub: React.CSSProperties = { color: C.muted, margin: "0 0 16px", fontSize: 13.5 };
const th: React.CSSProperties = { textAlign: "left", color: C.muted, fontWeight: 600, padding: 8, borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap", fontSize: 12.5 };
const td: React.CSSProperties = { padding: "9px 8px", borderBottom: `1px solid ${C.line}`, verticalAlign: "middle", fontSize: 13 };
const inputS: React.CSSProperties = { width: "100%", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 13.5, boxSizing: "border-box", background: "#fff" };
const labelS: React.CSSProperties = { display: "block", fontWeight: 600, fontSize: 12.5, margin: "12px 0 6px" };
const btnP: React.CSSProperties = { border: 0, borderRadius: 6, padding: "9px 16px", fontWeight: 600, fontSize: 13.5, cursor: "pointer", background: C.blue, color: "#fff" };
const btnG: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 6, padding: "9px 16px", fontWeight: 600, fontSize: 13.5, cursor: "pointer", background: "#fff", color: "#1B2437" };
const foot: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18, flexWrap: "wrap" };
const tiles: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 14 };

const STEPS = ["Create", "Founder list", "Data check", "Matches", "Content", "Schedule", "Results"];
const FOUNDER_TYPE: Record<string, { label: string; bg: string; fg: string }> = {
  lead: { label: "Lead only", bg: "#EEF0F5", fg: "#4A5268" },
  existing_user: { label: "Existing user", bg: "#E7F7EF", fg: C.ok },
  in_pipeline: { label: "In pipeline", bg: "#FDF3E1", fg: C.warn },
};

function Tag({ tag }: { tag: SourceTag }) {
  const style = tag.tone === "good" ? { background: "#E7F7EF", color: C.ok } : tag.tone === "bad" ? { background: "#FBEAEA", color: C.bad } : { background: "#FDF3E1", color: C.warn };
  return <span style={{ ...style, display: "inline-block", fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 4, marginLeft: 5 }}>{tag.label}</span>;
}

function Pill({ text, tone }: { text: string; tone: "ok" | "bad" | "warn" | "lead" }) {
  const s = tone === "ok" ? { background: "#E7F7EF", color: C.ok } : tone === "bad" ? { background: "#FBEAEA", color: C.bad } : tone === "warn" ? { background: "#FDF3E1", color: C.warn } : { background: "#EEF0F5", color: "#4A5268" };
  return <span style={{ ...s, display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>{text}</span>;
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: C.muted, margin: "10px 0 0" }}>
      <span><Tag tag={{ key: "crm", label: "CRM", tone: "good" }} /> entered by founder or team</span>
      <span><Tag tag={{ key: "high", label: "High / Medium / Summary", tone: "warn" }} /> inferred</span>
      <span><Tag tag={{ key: "guess", label: "Guess", tone: "warn" }} /> default, no data</span>
      <span><Tag tag={{ key: "low", label: "Low", tone: "bad" }} /> low confidence</span>
    </div>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

type Props = {
  initialCampaign: MatchCampaign;
  initialCounts: CampaignCounts;
  initialStep: number;
  lists: Array<{ id: string; name: string }>;
  industries: string[];
  stages: string[];
};

export function MatchCampaignWizard({ initialCampaign, initialCounts, initialStep, lists, industries, stages }: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [counts, setCounts] = useState(initialCounts);
  const [step, setStep] = useState(initialStep);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const base = `/api/admin/marketing/match/${campaign.id}`;
  const locked = campaign.status === "scheduled" || campaign.status === "sent" || campaign.status === "sending";

  const refresh = useCallback(async () => {
    const d = await api<{ campaign: MatchCampaign; counts: CampaignCounts }>(base);
    setCampaign(d.campaign);
    setCounts(d.counts);
  }, [base]);

  const go = (s: number) => { setStep(s); setMsg(null); window.scrollTo(0, 0); router.replace(`?step=${s}`, { scroll: false }); };
  const done = (s: number) =>
    s === 1 ? true : s === 2 || s === 3 ? counts.selected > 0 : s === 4 ? counts.withMatches > 0 && counts.matchedPending === 0 : s === 5 ? counts.withMatches > 0 : s === 6 ? locked : false;

  return (
    <div style={{ padding: 24, maxWidth: 1100, fontFamily: "Inter, system-ui, sans-serif", color: "#1B2437" }}>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>
        <Link href="/admin/marketing/campaigns" style={{ color: C.steel, textDecoration: "none" }}>Campaigns</Link> › {campaign.name}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "Archivo, sans-serif", fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>{campaign.name}</h1>
        <Pill text="Match" tone="ok" />
        <Pill text={campaign.status} tone={campaign.status === "sent" ? "ok" : campaign.status === "scheduled" ? "warn" : "lead"} />
        {campaign.config.dry_run && <Pill text="Dry run: no real email" tone="warn" />}
      </div>
      <div style={{ background: "#EAF1FD", border: "1px solid #CFE0FA", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginBottom: 14 }}>
        <b>Use all values.</b> Matching uses every filled industry and stage, including guesses. Tags show where each value came from. Match campaigns email founders only; no email goes to investors.
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
        {STEPS.map((label, i) => {
          const s = i + 1;
          const on = s === step;
          const ok = !on && done(s);
          return (
            <button key={label} type="button" onClick={() => go(s)}
              style={{ flex: "0 0 auto", border: `1px solid ${on ? C.blue : C.line}`, background: "#fff", borderRadius: 20, padding: "7px 12px", fontSize: 13, fontWeight: 500, color: on ? C.blue : C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <b style={{ display: "inline-grid", placeItems: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 11, background: on ? C.blue : ok ? C.ok : C.line, color: on || ok ? "#fff" : C.muted }}>{ok ? "✓" : s}</b>
              {label}
            </button>
          );
        })}
      </div>

      {msg && (
        <div style={{ marginBottom: 12, fontSize: 13, borderRadius: 8, padding: "8px 12px", background: msg.ok ? "#E7F7EF" : "#FBEAEA", color: msg.ok ? C.ok : C.bad }}>{msg.text}</div>
      )}

      {step === 1 && <StepCreate campaign={campaign} base={base} locked={locked} onSaved={(c) => { setCampaign(c); go(2); }} setMsg={setMsg} />}
      {step === 2 && <StepFounders base={base} lists={lists} industries={industries} stages={stages} locked={locked} onChecked={async () => { await refresh(); go(3); }} onBack={() => go(1)} setMsg={setMsg} />}
      {step === 3 && <StepCheck base={base} campaign={campaign} counts={counts} locked={locked} onConfig={async (c) => { setCampaign(c); }} onRecheck={refresh} onNext={() => go(4)} onBack={() => go(2)} setMsg={setMsg} />}
      {step === 4 && <StepMatches base={base} counts={counts} locked={locked} onCounts={setCounts} onNext={() => go(5)} onBack={() => go(3)} setMsg={setMsg} />}
      {step === 5 && <StepContent base={base} campaign={campaign} locked={locked} onSaved={setCampaign} onNext={() => go(6)} onBack={() => go(4)} setMsg={setMsg} />}
      {step === 6 && <StepSchedule base={base} campaign={campaign} counts={counts} onChanged={refresh} onSaved={setCampaign} onNext={() => go(7)} onBack={() => go(5)} setMsg={setMsg} />}
      {step === 7 && <StepResults base={base} campaign={campaign} onSaved={setCampaign} onBack={() => go(6)} />}
    </div>
  );
}

type SetMsg = (m: { ok: boolean; text: string } | null) => void;

// ── Step 1 ────────────────────────────────────────────────────────────────────
function StepCreate({ campaign, base, locked, onSaved, setMsg }: { campaign: MatchCampaign; base: string; locked: boolean; onSaved: (c: MatchCampaign) => void; setMsg: SetMsg }) {
  const [f, setF] = useState({ name: campaign.name, from_name: campaign.from_name, from_email: campaign.from_email, reply_to: campaign.reply_to ?? "" });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const d = await api<{ campaign: MatchCampaign }>(base, { method: "PATCH", body: JSON.stringify(f) });
      onSaved(d.campaign);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }
  return (
    <div style={card}>
      <h2 style={h2}>Create campaign</h2><p style={sub}>Same campaign screen as today, type Match.</p>
      <label style={labelS}>Campaign name</label><input style={inputS} value={f.name} disabled={locked} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <div><label style={labelS}>From name</label><input style={inputS} value={f.from_name} disabled={locked} onChange={(e) => setF({ ...f, from_name: e.target.value })} /></div>
        <div><label style={labelS}>From email</label><input style={inputS} value={f.from_email} disabled={locked} onChange={(e) => setF({ ...f, from_email: e.target.value })} /></div>
        <div><label style={labelS}>Reply to</label><input style={inputS} value={f.reply_to} disabled={locked} onChange={(e) => setF({ ...f, reply_to: e.target.value })} /></div>
      </div>
      <div style={foot}>
        <Link href="/admin/marketing/campaigns" style={{ ...btnG, textDecoration: "none" }}>Back to campaigns</Link>
        <button type="button" style={{ ...btnP, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => (locked ? onSaved(campaign) : void save())}>Next: founder list</button>
      </div>
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
type Candidate = { id: string; company: string | null; name: string | null; email: string | null; email_status: string | null; founder_type: string | null; pipeline_stage: string | null; industry: string | null; stage: string | null; industry_tag: SourceTag; stage_tag: SourceTag };

function StepFounders({ base, lists, industries, stages, locked, onChecked, onBack, setMsg }: { base: string; lists: Array<{ id: string; name: string }>; industries: string[]; stages: string[]; locked: boolean; onChecked: () => Promise<void>; onBack: () => void; setMsg: SetMsg }) {
  const [listId, setListId] = useState("");
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [busy, setBusy] = useState(false);

  const typeOptions = ["Lead only", "Existing user", "In pipeline"];
  const typeKey: Record<string, string> = { "Lead only": "lead", "Existing user": "existing_user", "In pipeline": "in_pipeline" };
  const sourceOptions = SOURCE_KEYS.map((k) => SOURCE_FILTER_LABELS[k]);
  const sourceKey = (label: string) => SOURCE_KEYS.find((k) => SOURCE_FILTER_LABELS[k] === label) as SourceKey;

  const filter = useMemo(() => ({
    q: search.q,
    founderType: (search.fields.type ?? []).map((t) => typeKey[t]).filter(Boolean),
    industry: search.fields.industry ?? [],
    stage: search.fields.stage ?? [],
    source: (search.fields.source ?? []).map(sourceKey).filter(Boolean),
    listId: listId || null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [search, listId]);

  const query = useMemo(() => {
    const sp = new URLSearchParams({ page: String(page), size: "50" });
    if (filter.q) sp.set("q", filter.q);
    if (filter.listId) sp.set("list", filter.listId);
    filter.founderType.forEach((v) => sp.append("type", v));
    filter.industry.forEach((v) => sp.append("industry", v));
    filter.stage.forEach((v) => sp.append("stage", v));
    filter.source.forEach((v) => sp.append("source", v));
    return sp.toString();
  }, [filter, page]);
  const loading = loadedKey !== query;

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api<{ rows: Candidate[]; total: number }>(`${base}/candidates?${query}`)
        .then((d) => { if (live) { setRows(d.rows); setTotal(d.total); } })
        .catch((e) => live && setMsg({ ok: false, text: (e as Error).message }))
        .finally(() => live && setLoadedKey(query));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [base, query, setMsg]);

  /** A new filter starts again at page 1 with nothing selected. */
  function resetSelection() { setPage(0); setAllSelected(false); setSelected(new Set()); }

  const count = allSelected ? total : selected.size;
  const toggle = (id: string) => { setAllSelected(false); setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const pageAll = rows.length > 0 && rows.every((r) => allSelected || selected.has(r.id));

  async function next() {
    if (count === 0) { setMsg({ ok: false, text: "Select at least one founder." }); return; }
    setBusy(true);
    try {
      await api(base, { method: "POST", body: JSON.stringify(allSelected ? { action: "check", filter } : { action: "check", founderIds: [...selected] }) });
      await onChecked();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div style={card}>
      <h2 style={h2}>Pick the founder list</h2><p style={sub}>Choose a saved list or filter founders directly. These founders receive the email.</p>
      {locked && <p style={{ ...sub, color: C.warn }}>This campaign is scheduled. Unschedule it on the Schedule step to change the list.</p>}
      <label style={labelS}>Founder list</label>
      <select style={{ ...inputS, maxWidth: 420 }} value={listId} onChange={(e) => { setListId(e.target.value); resetSelection(); }}>
        <option value="">All founders</option>
        {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <div style={{ height: 12 }} />
      <OdooSearchBar
        scope="match_campaign_founders"
        state={search}
        onChange={(next) => { setSearch(next); resetSelection(); }}
        quick={[]}
        fields={[
          { key: "type", label: "Founder type", options: typeOptions },
          { key: "industry", label: "Industry", options: industries },
          { key: "stage", label: "Stage", options: stages },
          { key: "source", label: "Value source", options: sourceOptions },
        ]}
        groups={[]}
        placeholder="Search company, founder, email, pipeline stage…"
        width="100%"
      />
      <p style={{ fontSize: 12, color: C.muted, margin: "8px 0" }} aria-live="polite">
        {loading ? "Loading…" : search.q ? <><b style={{ color: "#1B2437" }}>{total.toLocaleString()}</b> founders match &ldquo;{search.q}&rdquo;</> : <><b style={{ color: "#1B2437" }}>{total.toLocaleString()}</b> founders</>}
      </p>
      <SelectionBar count={count} total={total} onSelectAll={() => setAllSelected(true)} onClear={() => { setAllSelected(false); setSelected(new Set()); }} actions={[]} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}><input type="checkbox" checked={pageAll} onChange={() => { setAllSelected(false); setSelected((s) => { const n = new Set(s); if (pageAll) rows.forEach((r) => n.delete(r.id)); else rows.forEach((r) => n.add(r.id)); return n; }); }} /></th>
            <th style={th}>Company</th><th style={th}>Founder type</th><th style={th}>Pipeline stage</th><th style={th}>Industry</th><th style={th}>Stage</th><th style={th}>Email</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const ft = FOUNDER_TYPE[r.founder_type ?? "lead"] ?? FOUNDER_TYPE.lead;
              return (
                <tr key={r.id}>
                  <td style={td}><input type="checkbox" checked={allSelected || selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td style={td}><Highlight text={r.company || r.name || "—"} query={search.q} /></td>
                  <td style={td}><span style={{ background: ft.bg, color: ft.fg, padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 500 }}>{ft.label}</span></td>
                  <td style={td}><Highlight text={r.pipeline_stage ?? "Not in pipeline"} query={search.q} /></td>
                  <td style={td}>{r.industry ? <>{r.industry}<Tag tag={r.industry_tag} /></> : <Pill text="Not filled" tone="warn" />}</td>
                  <td style={td}>{r.stage ? <>{r.stage}<Tag tag={r.stage_tag} /></> : <Pill text="Not filled" tone="warn" />}</td>
                  <td style={{ ...td, color: C.muted }}>{r.email_status ?? "—"}</td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: C.muted, padding: 28 }}>
                {search.q ? <>Nothing matches &ldquo;{search.q}&rdquo;. Searched company, founder, email and pipeline stage.</> : "No founders for these filters."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} size={50} onPage={setPage} />
      <Legend />
      <div style={foot}>
        <button type="button" style={btnG} onClick={onBack}>Back</button>
        <button type="button" style={{ ...btnP, opacity: busy || locked || count === 0 ? 0.6 : 1 }} disabled={busy || locked || count === 0} onClick={() => void next()}>
          {busy ? "Checking…" : `Next: data check (${count.toLocaleString()})`}
        </button>
      </div>
    </div>
  );
}

function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", marginTop: 10, fontSize: 12.5, color: C.muted }}>
      <button type="button" style={{ ...btnG, padding: "5px 10px", fontSize: 12.5 }} disabled={page === 0} onClick={() => onPage(page - 1)}>‹ Prev</button>
      <span>Page {page + 1} of {pages.toLocaleString()}</span>
      <button type="button" style={{ ...btnG, padding: "5px 10px", fontSize: 12.5 }} disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────────
function useFounders(base: string, view: string, q: string, page: number, reloadKey: number) {
  const [data, setData] = useState<{ rows: CampaignFounderRow[]; total: number }>({ rows: [], total: 0 });
  const key = `${view}|${q}|${page}|${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const sp = new URLSearchParams({ view, page: String(page), size: "50" });
    if (q) sp.set("q", q);
    const t = setTimeout(() => {
      api<{ rows: CampaignFounderRow[]; total: number }>(`${base}/founders?${sp}`)
        .then((d) => live && setData(d))
        .catch(() => live && setData({ rows: [], total: 0 }))
        .finally(() => live && setLoadedKey(key));
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [base, view, q, page, key]);
  return { ...data, loading: loadedKey !== key };
}

function StepCheck({ base, campaign, counts, locked, onConfig, onRecheck, onNext, onBack, setMsg }: { base: string; campaign: MatchCampaign; counts: CampaignCounts; locked: boolean; onConfig: (c: MatchCampaign) => Promise<void>; onRecheck: () => Promise<void>; onNext: () => void; onBack: () => void; setMsg: SetMsg }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const { rows, total, loading } = useFounders(base, "all", q, page, reload);
  const [guessed, setGuessed] = useState<number | null>(null);

  // Ready founders that rely on a guessed or inferred value: counted from the check rows.
  useEffect(() => {
    let live = true;
    api<{ rows: CampaignFounderRow[]; total: number }>(`${base}/founders?view=ready&size=200`).then((d) => {
      if (!live) return;
      setGuessed(d.total <= 200 ? d.rows.filter((r) => r.industry_tag.key !== "crm" || r.stage_tag.key !== "crm").length : null);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [base, reload]);

  async function saveConfig(patch: Partial<MatchCampaign["config"]>) {
    setBusy(true);
    try {
      const d = await api<{ campaign: MatchCampaign }>(base, { method: "PATCH", body: JSON.stringify({ config: patch }) });
      await onConfig(d.campaign);
      setMsg({ ok: true, text: "Saved. Go back to the founder list and run the check again to apply it." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const excludedTotal = counts.excluded;
  const ready = counts.ready - counts.noMatches;
  return (
    <div style={card}>
      <h2 style={h2}>Data check</h2>
      <p style={sub}>Every filled value is used for matching, including guesses and low confidence. Founders are excluded only if industry or stage is empty, the email is invalid, or they unsubscribed.</p>
      <div style={{ background: "#E7F7EF", border: "1px solid #BFE6D2", borderRadius: 6, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>
        <b>Matching rule: use all values.</b> {campaign.config.exclude_sources.length ? `Except sources you left out: ${campaign.config.exclude_sources.map((k) => SOURCE_FILTER_LABELS[k]).join(", ")}.` : "No source is left out."}
      </div>
      <div style={tiles}>
        <MetricCard label="Founders selected" value={counts.selected.toLocaleString()} detail="From the founder list step" audience="admin" />
        <MetricCard label="Ready to match" value={ready.toLocaleString()} unit={`of ${counts.selected.toLocaleString()}`} detail="Industry, stage and a sendable email" ring={{ percent: counts.selected ? Math.round((ready / counts.selected) * 100) : null }} audience="admin" />
        <MetricCard label="Ready, using a guessed value" value={guessed === null ? "—" : guessed.toLocaleString()} detail={guessed === null ? "Shown for up to 200 ready founders" : "Industry or stage is inferred or guessed"} audience="admin" />
        <MetricCard label="Excluded" value={excludedTotal.toLocaleString()} detail="See the reason on each row" flag={excludedTotal ? { text: "Can join a later campaign once fixed", tone: "warn" } : null} audience="admin" />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 10, fontSize: 13 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={campaign.config.exclude_eu} disabled={busy || locked} onChange={(e) => void saveConfig({ exclude_eu: e.target.checked })} /> Exclude EU founders</label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={campaign.config.verified_only} disabled={busy || locked} onChange={(e) => void saveConfig({ verified_only: e.target.checked })} /> Verified emails only</label>
        <span style={{ color: C.muted }}>Leave out:</span>
        {SOURCE_KEYS.filter((k) => k !== "crm").map((k) => {
          const on = campaign.config.exclude_sources.includes(k);
          return (
            <button key={k} type="button" disabled={busy || locked}
              onClick={() => void saveConfig({ exclude_sources: on ? campaign.config.exclude_sources.filter((x) => x !== k) : [...campaign.config.exclude_sources, k] })}
              style={{ fontSize: 12, borderRadius: 12, padding: "3px 9px", cursor: "pointer", border: `1px solid ${on ? C.bad : C.line}`, background: on ? "#FBEAEA" : "#fff", color: on ? C.bad : C.muted }}>
              {SOURCE_FILTER_LABELS[k]}
            </button>
          );
        })}
      </div>
      <input style={{ ...inputS, maxWidth: 360, marginBottom: 8 }} placeholder="Search company, email, industry, stage…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      <p style={{ fontSize: 12, color: C.muted, margin: "0 0 6px" }}>{loading ? "Loading…" : `${total.toLocaleString()} founders${q ? ` match “${q}”` : ""}`}</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Company</th><th style={th}>Industry</th><th style={th}>Stage</th><th style={th}>Email</th><th style={th}>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}><Highlight text={r.company || "—"} query={q} /></td>
                <td style={td}>{r.industry ? <><Highlight text={r.industry} query={q} /><Tag tag={r.industry_tag} /></> : "Not filled"}</td>
                <td style={td}>{r.funding_stage ? <><Highlight text={r.funding_stage} query={q} /><Tag tag={r.stage_tag} /></> : "Not filled"}</td>
                <td style={{ ...td, color: C.muted }}>{r.email_status === "valid" ? "Verified" : r.email_status === "invalid" ? "Invalid" : r.email_status ? r.email_status.charAt(0).toUpperCase() + r.email_status.slice(1) : "—"}</td>
                <td style={td}>{r.excluded_reason ? <Pill text={EXCLUDED_LABEL[r.excluded_reason as ExcludedReason] ?? r.excluded_reason} tone={r.excluded_reason === "no_matches" ? "warn" : "bad"} /> : <Pill text="Ready" tone="ok" />}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: C.muted, padding: 24 }}>{q ? `Nothing matches “${q}”. Searched company, email, industry and stage.` : "No founders checked yet. Pick a founder list first."}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} size={50} onPage={setPage} />
      <p style={{ color: C.muted, fontSize: 12, marginTop: 10 }}>Excluded founders stay in the CRM and can join a later campaign once their data is fixed.</p>
      <div style={foot}>
        <button type="button" style={btnG} onClick={onBack}>Back</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={btnG} onClick={() => { void onRecheck(); setReload((n) => n + 1); }}>Refresh</button>
          <button type="button" style={{ ...btnP, opacity: ready ? 1 : 0.6 }} disabled={!ready} onClick={onNext}>Next: matches</button>
        </div>
      </div>
    </div>
  );
}

// ── Step 4 ────────────────────────────────────────────────────────────────────
function StepMatches({ base, counts, locked, onCounts, onNext, onBack, setMsg }: { base: string; counts: CampaignCounts; locked: boolean; onCounts: (c: CampaignCounts) => void; onNext: () => void; onBack: () => void; setMsg: SetMsg }) {
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const { rows, total, loading } = useFounders(base, "matched", q, page, reload);
  const [open, setOpen] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      for (let i = 0; i < 200; i++) {
        const d = await api<{ processed: number; remaining: number; counts: CampaignCounts }>(base, { method: "POST", body: JSON.stringify({ action: "run" }) });
        onCounts(d.counts);
        setReload((n) => n + 1);
        if (d.remaining === 0 || d.processed === 0) break;
      }
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setRunning(false); }
  }, [base, onCounts, setMsg]);

  // Matching starts by itself when this step opens with ready founders not yet matched.
  const autoRun = counts.matchedPending > 0 && !locked;
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (!autoRun || autoStarted) return;
    const t = setTimeout(() => { setAutoStarted(true); void run(); }, 0);
    return () => clearTimeout(t);
  }, [autoRun, autoStarted, run]);

  const ready = counts.ready;
  return (
    <div style={card}>
      <h2 style={h2}>Matches per founder</h2><p style={sub}>Each ready founder is matched to investors on industry and stage, the same way icapos.com/fit matches. Admin reviews and removes anyone. Investors are not contacted.</p>
      <div style={tiles}>
        <MetricCard label="Founders ready" value={ready.toLocaleString()} detail="Passed the data check" audience="admin" />
        <MetricCard label="With 1 or more matches" value={counts.withMatches.toLocaleString()} unit={`of ${ready.toLocaleString()}`} ring={{ percent: ready ? Math.round((counts.withMatches / ready) * 100) : null }} detail={counts.matchedPending ? `${counts.matchedPending.toLocaleString()} still matching` : "Matching finished"} audience="admin" />
        <MetricCard label="No matches, skipped" value={counts.noMatches.toLocaleString()} detail="Not emailed" audience="admin" />
        <MetricCard label="Founders will be emailed" value={counts.toSend.toLocaleString()} detail="Investors emailed: 0" audience="admin" />
      </div>
      {(running || counts.matchedPending > 0) && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, fontSize: 13 }}>
          {running ? <span>Matching… {counts.matchedPending.toLocaleString()} founders left.</span> : <><span>{counts.matchedPending.toLocaleString()} founders not matched yet.</span><button type="button" style={btnP} onClick={() => void run()}>Run matching</button></>}
        </div>
      )}
      <input style={{ ...inputS, maxWidth: 360, marginBottom: 8 }} placeholder="Search company, email, industry, stage…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      <p style={{ fontSize: 12, color: C.muted, margin: "0 0 6px" }}>{loading ? "Loading…" : `${total.toLocaleString()} founders with matches${q ? ` match “${q}”` : ""}`}</p>
      {rows.map((r) => (
        <div key={r.id} style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 10, overflow: "hidden" }}>
          <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#FAFBFD", border: 0, cursor: "pointer", gap: 10, flexWrap: "wrap", textAlign: "left" }}>
            <div>
              <b style={{ fontSize: 14 }}><Highlight text={r.company || "—"} query={q} /></b>{" "}
              <span style={{ color: C.muted, fontSize: 12 }}>{r.industry}<Tag tag={r.industry_tag} /> · {r.funding_stage}<Tag tag={r.stage_tag} /></span>
            </div>
            <div><Pill text={`${r.match_count} ${r.match_count === 1 ? "match" : "matches"}`} tone="ok" /> {open === r.id ? "▾" : "▸"}</div>
          </button>
          {open === r.id && <FounderMatches base={base} founderId={r.id} locked={locked} onChanged={(c) => { onCounts(c); setReload((n) => n + 1); }} setMsg={setMsg} />}
        </div>
      ))}
      <Pager page={page} total={total} size={50} onPage={setPage} />
      <div style={foot}>
        <button type="button" style={btnG} onClick={onBack}>Back</button>
        <button type="button" style={{ ...btnP, opacity: counts.withMatches && !running ? 1 : 0.6 }} disabled={!counts.withMatches || running} onClick={onNext}>Next: content</button>
      </div>
    </div>
  );
}

function FounderMatches({ base, founderId, locked, onChanged, setMsg }: { base: string; founderId: string; locked: boolean; onChanged: (c: CampaignCounts) => void; setMsg: SetMsg }) {
  const [rows, setRows] = useState<AdminMatchRow[] | null>(null);
  const load = useCallback(() => {
    api<{ matches: AdminMatchRow[] }>(`${base}/founders?founder=${founderId}`).then((d) => setRows(d.matches)).catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, [base, founderId, setMsg]);
  useEffect(load, [load]);
  async function toggle(m: AdminMatchRow) {
    try {
      const d = await api<{ counts: CampaignCounts }>(base, { method: "POST", body: JSON.stringify({ action: m.removed ? "restore" : "remove", matchId: m.id }) });
      onChanged(d.counts);
      load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  if (!rows) return <p style={{ padding: 12, color: C.muted, fontSize: 13 }}>Loading matches…</p>;
  return (
    <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>Investor (admin view)</th><th style={th}>Type</th><th style={th}>Sector</th><th style={th}>Stage fit</th><th style={th}>Match</th><th style={th}></th></tr></thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} style={{ opacity: m.removed ? 0.45 : 1 }}>
              <td style={td}>{m.investor_company || m.investor_name || "Investor"}{m.investor_name && m.investor_company ? <span style={{ color: C.muted, fontSize: 12 }}> · {m.investor_name}</span> : null}</td>
              <td style={td}>{m.investor_type ?? "—"}</td>
              <td style={td}>{m.sectors.slice(0, 2).join(", ") || "—"}</td>
              <td style={td}>{m.stages.slice(0, 2).join(", ") || "—"}</td>
              <td style={td}><span style={{ display: "inline-block", width: 70, height: 6, borderRadius: 3, background: C.line, verticalAlign: "middle", marginRight: 6 }}><i style={{ display: "block", height: "100%", borderRadius: 3, background: C.blue, width: `${m.match_score}%` }} /></span>{m.match_score}%</td>
              <td style={td}>{!locked && <button type="button" onClick={() => void toggle(m)} style={{ border: 0, background: "none", cursor: "pointer", fontWeight: 600, color: m.removed ? C.steel : C.bad }}>{m.removed ? "Restore" : "Remove"}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 11.5, color: C.muted, padding: "6px 10px" }}>Top {rows.length} stored. Founders see these without names or contact info.</p>
    </div>
  );
}

// ── Step 5 ────────────────────────────────────────────────────────────────────
type Preview = { founderId: string; company: string | null; token: string; subject: string; html: string; text: string } | null;

function StepContent({ base, campaign, locked, onSaved, onNext, onBack, setMsg }: { base: string; campaign: MatchCampaign; locked: boolean; onSaved: (c: MatchCampaign) => void; onNext: () => void; onBack: () => void; setMsg: SetMsg }) {
  const [subject, setSubject] = useState(campaign.config.subject);
  const [founders, setFounders] = useState<CampaignFounderRow[]>([]);
  const [founder, setFounder] = useState<string>("");
  const [preview, setPreview] = useState<Preview>(null);
  const [tab, setTab] = useState<"email" | "page">("email");

  useEffect(() => {
    api<{ rows: CampaignFounderRow[] }>(`${base}/founders?view=matched&size=50`).then((d) => { setFounders(d.rows); if (d.rows[0]) setFounder(d.rows[0].id); }).catch(() => undefined);
  }, [base]);
  useEffect(() => {
    if (!founder) return;
    api<{ preview: Preview }>(`${base}?view=preview&founder=${founder}`).then((d) => setPreview(d.preview)).catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, [base, founder, campaign.config.subject, setMsg]);

  async function save(then?: () => void) {
    try {
      const d = await api<{ campaign: MatchCampaign }>(base, { method: "PATCH", body: JSON.stringify({ config: { subject } }) });
      onSaved(d.campaign);
      then?.();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }

  return (
    <div style={card}>
      <h2 style={h2}>Content</h2><p style={sub}>Each founder receives their own matches. Investor names and firms stay hidden until they choose a plan.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        <div>
          <label style={labelS}>Subject</label>
          <input style={inputS} value={subject} disabled={locked} onChange={(e) => setSubject(e.target.value)} onBlur={() => subject !== campaign.config.subject && void save()} />
          <p style={{ fontSize: 11.5, color: C.muted, margin: "4px 0 0" }}>Tokens: {"{match_count}"}, {"{company}"}. Say investors match, never that they are interested.</p>
        </div>
        <div>
          <label style={labelS}>Preview founder</label>
          <select style={inputS} value={founder} onChange={(e) => setFounder(e.target.value)}>
            {founders.map((f) => <option key={f.id} value={f.id}>{f.company || f.email} ({f.match_count})</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, margin: "14px 0 10px" }}>
        {(["email", "page"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{ border: `1px solid ${tab === t ? C.blue : C.line}`, color: tab === t ? C.blue : C.muted, background: "#fff", borderRadius: 20, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>{t === "email" ? "Founder email" : "Match page"}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 260px", gap: 16 }}>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", minHeight: 520 }}>
          {!preview ? <p style={{ padding: 16, color: C.muted }}>No founder with matches yet. Run matching first.</p>
            : tab === "email" ? (
              <>
                <div style={{ padding: "8px 12px", background: "#FAFBFD", borderBottom: `1px solid ${C.line}`, fontSize: 12.5 }}><b>Subject:</b> {preview.subject}</div>
                <iframe title="Founder email preview" srcDoc={preview.html} style={{ width: "100%", height: 640, border: 0 }} sandbox="" />
              </>
            ) : (
              <iframe title="Match page preview" src={`/matches/${preview.token}`} style={{ width: "100%", height: 680, border: 0 }} />
            )}
        </div>
        <div style={{ fontSize: 13 }}>
          <div style={{ ...card, padding: 14 }}>
            <b>What the founder sees</b>
            <ul style={{ paddingLeft: 18, margin: "8px 0 0", color: "#3A4358", lineHeight: 1.6 }}>
              <li>The note: our network of investors, and their match count.</li>
              <li>Top 3 matches: type, sector, stage fit and match %. Names hidden.</li>
              <li>See all matches: the web match page. Each match expands like icapos.com/fit.</li>
            </ul>
          </div>
          <div style={{ ...card, padding: 14 }}>
            <b>What each button does</b>
            <ul style={{ paddingLeft: 18, margin: "8px 0 0", color: "#3A4358", lineHeight: 1.6 }}>
              <li><b>Schedule a call with us:</b> the iCapOS scheduling page.</li>
              <li><b>Get introduced today:</b> choose a plan at /start. After paying, names and Request introduction unlock in the app.</li>
            </ul>
            <p style={{ color: C.muted, fontSize: 12, margin: "8px 0 0" }}>Opening the preview page records a page open for this founder.</p>
          </div>
        </div>
      </div>
      <div style={foot}>
        <button type="button" style={btnG} onClick={onBack}>Back</button>
        <button type="button" style={btnP} onClick={() => (locked ? onNext() : void save(onNext))}>Next: schedule</button>
      </div>
    </div>
  );
}

// ── Step 6 ────────────────────────────────────────────────────────────────────
function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function StepSchedule({ base, campaign, counts, onChanged, onSaved, onNext, onBack, setMsg }: { base: string; campaign: MatchCampaign; counts: CampaignCounts; onChanged: () => Promise<void>; onSaved: (c: MatchCampaign) => void; onNext: () => void; onBack: () => void; setMsg: SetMsg }) {
  const [at, setAt] = useState(toLocalInput(campaign.scheduled_at));
  const [cap, setCap] = useState(String(campaign.config.daily_cap));
  const [busy, setBusy] = useState(false);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const scheduled = campaign.status === "scheduled";

  async function patchConfig(config: Partial<MatchCampaign["config"]>) {
    const d = await api<{ campaign: MatchCampaign }>(base, { method: "PATCH", body: JSON.stringify({ config }) });
    onSaved(d.campaign);
  }
  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      if (Number(cap) !== campaign.config.daily_cap) await patchConfig({ daily_cap: Number(cap), time_zone: tz });
      const d = await api<{ ok?: boolean; error?: string; to?: string }>(base, { method: "POST", body: JSON.stringify(body) });
      await onChanged();
      setMsg({ ok: true, text: body.action === "test" ? `Test sent to ${d.to ?? "you"}.` : ok });
      if (body.action === "schedule" || body.action === "send_now") onNext();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const days = Math.max(1, Math.ceil(counts.toSend / Math.max(1, Number(cap) || 1)));
  return (
    <div style={card}>
      <h2 style={h2}>Schedule and send</h2><p style={sub}>Same scheduling as any campaign. Sends run in daily batches up to the cap.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        <div><label style={labelS}>Date and time</label><input type="datetime-local" style={inputS} value={at} disabled={scheduled} onChange={(e) => setAt(e.target.value)} /></div>
        <div><label style={labelS}>Daily send cap</label><input type="number" min={1} style={inputS} value={cap} disabled={scheduled} onChange={(e) => setCap(e.target.value)} /></div>
        <div><label style={labelS}>Time zone</label><input style={inputS} value={tz} disabled /></div>
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, marginTop: 12 }}>
        <input type="checkbox" checked={campaign.config.dry_run} disabled={scheduled || busy} onChange={(e) => void patchConfig({ dry_run: e.target.checked }).catch((err) => setMsg({ ok: false, text: (err as Error).message }))} />
        Dry run: go through every step and record results, but send no real email
      </label>
      <div style={{ marginTop: 14, maxWidth: 460, fontSize: 13 }}>
        {[
          ["Founder recipients", counts.toSend.toLocaleString()],
          ["Investors emailed", "0"],
          ["Already sent", (counts.sent + counts.dryRun).toLocaleString()],
          ["Days to finish at this cap", counts.toSend ? String(days) : "—"],
          ["Status", campaign.status + (campaign.scheduled_at ? ` · ${new Date(campaign.scheduled_at).toLocaleString()}` : "")],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span><b>{v}</b></div>
        ))}
      </div>
      <div style={foot}>
        <button type="button" style={btnG} onClick={onBack}>Back</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btnG} disabled={busy} onClick={() => void act({ action: "test" }, "")}>Send test to me</button>
          {scheduled ? (
            <>
              <button type="button" style={btnG} disabled={busy} onClick={() => void act({ action: "unschedule" }, "Unscheduled. The campaign is a draft again.")}>Unschedule</button>
              <button type="button" style={btnP} onClick={onNext}>See results</button>
            </>
          ) : campaign.status === "sent" ? (
            <button type="button" style={btnP} onClick={onNext}>See results</button>
          ) : (
            <>
              <button type="button" style={btnG} disabled={busy || counts.toSend === 0} onClick={() => void act({ action: "send_now" }, "Sending started. The rest go out in daily batches.")}>Send now</button>
              <button type="button" style={{ ...btnP, opacity: busy || counts.toSend === 0 ? 0.6 : 1 }} disabled={busy || counts.toSend === 0} onClick={() => void act({ action: "schedule", at: new Date(at).toISOString() }, "Campaign scheduled.")}>Schedule campaign</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 7 ────────────────────────────────────────────────────────────────────
function StepResults({ base, campaign, onSaved, onBack }: { base: string; campaign: MatchCampaign; onSaved: (c: MatchCampaign) => void; onBack: () => void }) {
  const [data, setData] = useState<{ results: MatchResults; counts: CampaignCounts } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState(campaign.config.campaign_cost_cents != null ? String(campaign.config.campaign_cost_cents / 100) : "");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api<{ results: MatchResults; counts: CampaignCounts }>(`${base}?view=results`).then(setData).catch((e) => setError((e as Error).message));
  }, [base, reload]);

  async function saveCost() {
    const v = cost.trim() === "" ? null : Math.round(Number(cost) * 100);
    if (v !== null && !Number.isFinite(v)) return;
    const d = await api<{ campaign: MatchCampaign }>(base, { method: "PATCH", body: JSON.stringify({ config: { campaign_cost_cents: v } }) });
    onSaved(d.campaign);
    setReload((n) => n + 1);
  }

  async function decide(kind: "prospect" | "member", id: string, decision: "introduce" | "hold" | "decline") {
    const url = kind === "prospect" ? `/api/admin/prospect-intros/${id}` : `/api/admin/intro-requests/${id}`;
    const status = kind === "prospect"
      ? { introduce: "contacted", hold: "new", decline: "dismissed" }[decision]
      : { introduce: "facilitated", hold: "reviewing", decline: "declined" }[decision];
    await fetch(url, { method: kind === "prospect" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setReload((n) => n + 1);
  }

  if (error) return <div style={card}><p style={{ color: C.bad }}>{error}</p></div>;
  if (!data) return <div style={card}><p style={{ color: C.muted }}>Loading results…</p></div>;
  const r = data.results;
  const base100 = r.emailed + r.dryRun;
  const pct = (n: number) => (base100 ? `${Math.round((n / base100) * 100)}%` : "—");
  const funnel: Array<[string, number]> = [
    ["Emailed", base100],
    ["Opened match page", r.pageOpened],
    ["Clicked Schedule a call", r.callClicks],
    ["Clicked Get introduced", r.introClicks],
    ["Signed up", r.signedUp],
    ["Started a paid plan", r.paid],
  ];
  const max = Math.max(1, ...funnel.map(([, n]) => n));
  return (
    <div style={card}>
      <h2 style={h2}>Results</h2><p style={sub}>Measured counts only. A figure that is not measured shows blank, never an estimate.</p>
      {r.dryRun > 0 && <p style={{ ...sub, color: C.warn }}>{r.dryRun.toLocaleString()} founders were handled in dry run mode: no real email was sent to them.</p>}
      <div style={tiles}>
        <MetricCard label="Founders emailed" value={r.emailed.toLocaleString()} unit={`of ${data.counts.withMatches.toLocaleString()} with matches`} ring={{ percent: data.counts.withMatches ? Math.round((r.emailed / data.counts.withMatches) * 100) : null }} detail={`Investors emailed: 0`} audience="admin" />
        <MetricCard label="Email opens" value={r.opened === null ? "—" : r.opened.toLocaleString()} detail={r.opened === null ? "No sends measured yet" : `${pct(r.opened)} of emailed, from delivery webhooks`} audience="admin" />
        <MetricCard label="Match page opens" value={r.pageOpened.toLocaleString()} detail={`${pct(r.pageOpened)} of emailed`} audience="admin" />
        <MetricCard label="Paid conversion" value={r.paid.toLocaleString()} detail={`${pct(r.paid)} of emailed · $${(r.revenue90dCents / 100).toLocaleString()} plan revenue, first 90 days`} audience="admin" />
      </div>
      <h3 style={{ fontSize: 14, margin: "6px 0 10px", fontFamily: "Archivo, sans-serif" }}>Founder funnel</h3>
      {funnel.map(([label, n]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 190, fontSize: 13, color: C.muted }}>{label}</div>
          <div style={{ flex: 1, background: C.line, borderRadius: 4, height: 22, position: "relative" }}><i style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4, background: C.blue, width: `${(n / max) * 100}%` }} /></div>
          <div style={{ width: 70, textAlign: "right", fontWeight: 600, fontSize: 13 }}>{n.toLocaleString()}</div>
        </div>
      ))}
      <p style={{ fontSize: 12, color: C.muted }}>Booked calls are not measured here yet: bookings are not linked to campaign clicks. Call clicks are shown instead.</p>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", margin: "12px 0" }}>
        <div><label style={labelS}>Campaign cost (USD, email plus admin hours)</label><input style={{ ...inputS, width: 200 }} value={cost} onChange={(e) => setCost(e.target.value)} onBlur={() => void saveCost()} placeholder="Enter to see ROI" /></div>
        <div style={{ fontSize: 13, paddingBottom: 8 }}>ROI: <b>{r.roi === null ? "—" : `${Math.round(r.roi * 100)}%`}</b> <span style={{ color: C.muted }}>(90 day plan revenue minus cost, divided by cost)</span></div>
      </div>
      <h3 style={{ fontSize: 14, margin: "16px 0 10px", fontFamily: "Archivo, sans-serif" }}>Introductions to approve</h3>
      <p style={{ fontSize: 12.5, color: C.muted, margin: "0 0 8px" }}>{r.introsRequested.toLocaleString()} requested, {r.introsCompleted.toLocaleString()} completed, by founders from this campaign after they paid.</p>
      {r.intros.length === 0 ? <p style={{ fontSize: 13, color: C.muted }}>None waiting.</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Founder company</th><th style={th}>Requested</th><th style={th}>Status</th><th style={th}></th></tr></thead>
          <tbody>
            {r.intros.map((x) => (
              <tr key={x.id}>
                <td style={td}>{x.company ?? "—"}</td>
                <td style={td}>{new Date(x.createdAt).toLocaleDateString()}</td>
                <td style={td}><Pill text={x.status} tone="warn" /></td>
                <td style={td}>
                  <button type="button" style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 5, padding: "4px 8px", fontSize: 12, cursor: "pointer", marginRight: 4, color: C.ok }} onClick={() => void decide(x.kind, x.id, "introduce")}>Introduce</button>
                  <button type="button" style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 5, padding: "4px 8px", fontSize: 12, cursor: "pointer", marginRight: 4 }} onClick={() => void decide(x.kind, x.id, "hold")}>Hold</button>
                  <button type="button" style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 5, padding: "4px 8px", fontSize: 12, cursor: "pointer", color: C.bad }} onClick={() => void decide(x.kind, x.id, "decline")}>Decline</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={foot}>
        <button type="button" style={btnG} onClick={onBack}>Back</button>
        <button type="button" style={btnG} onClick={() => setReload((n) => n + 1)}>Refresh</button>
      </div>
    </div>
  );
}
