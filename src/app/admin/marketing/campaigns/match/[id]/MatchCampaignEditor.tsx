"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { SelectionBar } from "@/components/admin/sales/SelectionBar";
import type { MatchCampaignRow, CampaignFounderRow, AdminMatchRow, RunSummary, RunBatch } from "@/lib/marketing/match-campaign/store";
import { MAX_CAMPAIGN_FOUNDERS } from "@/lib/marketing/match-campaign/types";
import type { MatchResults } from "@/lib/marketing/match-campaign/results";
import type { CohortSummaryRow, SequenceResults, VariantRow } from "@/lib/marketing/match-campaign/followups";
import { FOLLOWUP_STEPS, STOP_LABEL } from "@/lib/marketing/match-campaign/sequence";
import {
  DEFAULT_CALL_PATH,
  EXCLUDED_LABEL,
  FOUNDER_TYPE_LABEL,
  type FounderFieldsRow,
  type FounderType,
  type MatchConfig,
} from "@/lib/marketing/match-campaign/types";
import { filterToQuery, type FounderFilterInput } from "@/lib/marketing/match-campaign/filter-params";

type ListOption = { id: string; name: string; count: number | null };
type Options = { industries: string[]; stages: string[]; pipelineStages: string[] };

const STEPS_CLASSIC = ["Create", "Founder list", "Data check", "Matches", "Content", "Schedule", "Results"] as const;
const STEPS_SEQUENCE = ["Create", "Founder list", "Data check", "Matches", "Content", "Sequence", "Schedule", "Results"] as const;

const card = "rounded-xl border border-[#E3E8F2] bg-white p-5 shadow-[0_1px_3px_rgb(12_35_64/0.06)]";
const input = "w-full rounded-lg border border-[#E3E8F2] bg-[#F7F9FC] px-3 py-2 text-[13px] text-[#0A1A40] outline-none focus:border-[#1A6CE4]";
const label = "mb-1 block text-[11px] text-[#5A6782]";
const btn = "rounded-lg bg-[#1A6CE4] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50";
const btnGhost = "rounded-lg border border-[#E3E8F2] bg-white px-4 py-2 text-[13px] font-medium text-[#0A1A40] hover:bg-[#F7F9FC] disabled:opacity-50";
const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#8A94A8]";
const td = "px-3 py-2 text-[12.5px] text-[#0A1A40]";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
  return j as T;
}

function Tile({ value, label: l, tone }: { value: number | string | null; label: string; tone?: "warn" | "good" }) {
  const color = tone === "warn" ? "text-[#854F0B]" : tone === "good" ? "text-[#0F6E56]" : "text-[#0A1A40]";
  return (
    <div className="rounded-xl border border-[#E3E8F2] bg-white px-4 py-3">
      <div className={`text-[22px] font-bold ${color}`}>{value ?? "—"}</div>
      <div className="text-[11.5px] text-[#5A6782]">{l}</div>
    </div>
  );
}

function NotFilled() {
  return <span className="rounded bg-[#FAEEDA] px-1.5 py-0.5 text-[11px] font-medium text-[#854F0B]">Not filled</span>;
}

/** Wall-clock date and time in an IANA zone → UTC ISO string. */
function zonedToUtc(date: string, time: string, tz: string): string | null {
  if (!date || !time) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (ms: number) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - ms;
  };
  let utc = guess - offsetAt(guess);
  utc = guess - offsetAt(utc);
  return new Date(utc).toISOString();
}

function timeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  try {
    return intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : ["America/Los_Angeles", "America/New_York", "Europe/Paris", "UTC"];
  } catch {
    return ["America/Los_Angeles", "America/New_York", "Europe/Paris", "UTC"];
  }
}

export function MatchCampaignEditor({
  initialCampaign,
  lists,
  defaultSender,
  senders,
  resendReady,
  sequenceEnabled = false,
}: {
  initialCampaign: MatchCampaignRow | null;
  lists: ListOption[];
  defaultSender: { name: string; email: string; replyTo: string };
  senders: { name: string; email: string }[];
  resendReady: boolean;
  /** MATCH_SEQUENCE_ENABLED: adds the Sequence step, cohorts and the split test. */
  sequenceEnabled?: boolean;
}) {
  const router = useRouter();
  const STEPS = sequenceEnabled ? STEPS_SEQUENCE : STEPS_CLASSIC;
  const SEQ = sequenceEnabled ? 5 : -1;
  const SCHEDULE = sequenceEnabled ? 6 : 5;
  const RESULTS = sequenceEnabled ? 7 : 6;
  const [campaign, setCampaign] = useState<MatchCampaignRow | null>(initialCampaign);
  const [founders, setFounders] = useState<CampaignFounderRow[]>([]);
  const [options, setOptions] = useState<Options>({ industries: [], stages: [], pipelineStages: [] });
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (id: string) => {
    const j = await api<{ campaign: MatchCampaignRow; founders: CampaignFounderRow[]; options: Options }>(`/api/admin/marketing/match?id=${id}`);
    setCampaign(j.campaign);
    setFounders(j.founders);
    setOptions(j.options);
    return j;
  }, []);

  useEffect(() => {
    if (!initialCampaign) return;
    api<{ campaign: MatchCampaignRow; founders: CampaignFounderRow[]; options: Options }>(`/api/admin/marketing/match?id=${initialCampaign.id}`)
      .then((j) => {
        setCampaign(j.campaign);
        setFounders(j.founders);
        setOptions(j.options);
        const sent = j.founders.some((f) => f.send_status !== "pending");
        const matched = j.founders.some((f) => f.match_count > 0);
        setStep(sent || ["sending", "sent"].includes(j.campaign.status) ? RESULTS : matched ? 3 : j.founders.length ? 2 : 1);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [initialCampaign, RESULTS]);

  const reachable = (i: number) => i === 0 || Boolean(campaign && (i <= 1 || founders.length > 0));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-1 text-[12px] text-[#8A94A8]">
        <Link href="/admin/marketing/campaigns" className="hover:underline">Marketing Hub › Campaigns</Link> › {campaign ? campaign.name : "New Match campaign"}
      </div>
      <h1 className="mb-4 text-[18px] font-medium text-[#0A1A40]">
        {campaign ? campaign.name : "New campaign"}{" "}
        <span className="ml-1 rounded-lg bg-[#FFF4E0] px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[#8A5A00]">Match</span>
      </h1>
      <p className="mb-4 text-[12.5px] text-[#5A6782]">Match campaigns email founders only. No email goes to investors.</p>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            disabled={!reachable(i)}
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${i === step ? "bg-[#1A6CE4] text-white" : "border border-[#E3E8F2] bg-white text-[#5A6782] disabled:opacity-40"}`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#991B1B]">
          {error} <button type="button" className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}

      {step === 0 && (
        <StepCreate
          campaign={campaign}
          defaultSender={defaultSender}
          senders={senders}
          onError={setError}
          onSaved={(c, isNew) => {
            setCampaign(c);
            if (isNew) router.replace(`/admin/marketing/campaigns/match/${c.id}`);
            else setStep(1);
          }}
        />
      )}
      {step === 1 && campaign && (
        <StepFounders
          campaign={campaign}
          lists={lists}
          options={options}
          onError={setError}
          onChecked={(rows) => { setFounders(rows); setStep(2); }}
        />
      )}
      {step === 2 && campaign && (
        <StepCheck campaign={campaign} founders={founders} sequenceEnabled={sequenceEnabled} onError={setError} onChange={(c, rows) => { setCampaign(c); setFounders(rows); }} onCampaign={setCampaign} onNext={() => setStep(3)} />
      )}
      {step === 3 && campaign && (
        <StepMatches campaign={campaign} founders={founders} onError={setError} onFounders={setFounders} onCampaign={setCampaign} onNext={() => setStep(4)} />
      )}
      {step === 4 && campaign && (
        <StepContent campaign={campaign} founders={founders} sequenceEnabled={sequenceEnabled} onError={setError} onCampaign={setCampaign} onNext={() => setStep(sequenceEnabled ? SEQ : SCHEDULE)} />
      )}
      {sequenceEnabled && step === SEQ && campaign && (
        <StepSequence campaign={campaign} onError={setError} onCampaign={setCampaign} onNext={() => setStep(SCHEDULE)} />
      )}
      {step === SCHEDULE && campaign && (
        <StepSchedule campaign={campaign} founders={founders} resendReady={resendReady} sequenceEnabled={sequenceEnabled} onError={setError} onCampaign={setCampaign} onDone={() => reload(campaign.id).then(() => setStep(RESULTS))} />
      )}
      {step === RESULTS && campaign && <StepResults campaign={campaign} sequenceEnabled={sequenceEnabled} onError={setError} onCampaign={setCampaign} />}
    </div>
  );
}

// ── 1. Create ────────────────────────────────────────────────────────────────

function StepCreate({ campaign, defaultSender, senders, onSaved, onError }: {
  campaign: MatchCampaignRow | null;
  defaultSender: { name: string; email: string; replyTo: string };
  senders: { name: string; email: string }[];
  onSaved: (c: MatchCampaignRow, isNew: boolean) => void;
  onError: (e: string) => void;
}) {
  const [form, setForm] = useState({
    name: campaign?.name ?? "",
    from_name: campaign?.from_name ?? defaultSender.name,
    from_email: campaign?.from_email ?? defaultSender.email,
    reply_to: campaign?.reply_to ?? defaultSender.replyTo,
    call_url: campaign?.match_config.call_url ?? DEFAULT_CALL_PATH,
  });
  const [saving, setSaving] = useState(false);
  const locked = Boolean(campaign && !["draft", "scheduled", "paused"].includes(campaign.status));

  async function save() {
    setSaving(true);
    try {
      if (!campaign) {
        const j = await api<{ campaign: MatchCampaignRow }>("/api/admin/marketing/match", { method: "POST", body: JSON.stringify(form) });
        onSaved(j.campaign, true);
      } else {
        const j = await api<{ campaign: MatchCampaignRow }>("/api/admin/marketing/match", {
          method: "PATCH",
          body: JSON.stringify({ id: campaign.id, name: form.name, from_name: form.from_name, from_email: form.from_email, reply_to: form.reply_to || null, config: { call_url: form.call_url } }),
        });
        onSaved(j.campaign, false);
      }
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={card}>
      <div className="mb-1 text-[14px] font-medium">Create campaign</div>
      <p className="mb-4 text-[12.5px] text-[#5A6782]">Same campaign screen as today. Pick the type.</p>
      <label className={label}>Campaign type</label>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/admin/marketing/campaigns" className="rounded-xl border border-[#E3E8F2] bg-white px-4 py-3 hover:bg-[#F7F9FC]">
          <div className="text-[13px] font-semibold">Email</div>
          <div className="text-[11.5px] text-[#5A6782]">Send to a list you choose. Existing flow, unchanged.</div>
        </Link>
        <div className="rounded-xl border-[1.5px] border-[#1A6CE4] bg-[#F3F8FF] px-4 py-3">
          <div className="text-[13px] font-semibold">Match <span className="ml-1 rounded-lg bg-[#FFF4E0] px-1.5 py-px text-[9px] font-bold text-[#8A5A00]">NEW</span></div>
          <div className="text-[11.5px] text-[#5A6782]">Email founders their current investor matches. Matches are hidden until they choose a plan.</div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Campaign name</label>
          <input className={input} value={form.name} disabled={locked} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fintech seed founders, October" />
        </div>
        <div>
          <label className={label}>From name</label>
          <input className={input} value={form.from_name} disabled={locked} onChange={(e) => setForm({ ...form, from_name: e.target.value })} />
        </div>
        <div>
          <label className={label}>From email</label>
          {senders.length > 0 ? (
            <select className={input} value={form.from_email} disabled={locked} onChange={(e) => setForm({ ...form, from_email: e.target.value, from_name: senders.find((s) => s.email === e.target.value)?.name ?? form.from_name })}>
              {!senders.some((s) => s.email === form.from_email) && <option value={form.from_email}>{form.from_email}</option>}
              {senders.map((s) => <option key={s.email} value={s.email}>{s.name} &lt;{s.email}&gt;</option>)}
            </select>
          ) : (
            <input className={input} type="email" value={form.from_email} disabled={locked} onChange={(e) => setForm({ ...form, from_email: e.target.value })} />
          )}
        </div>
        <div>
          <label className={label}>Reply to</label>
          <input className={input} type="email" value={form.reply_to} disabled={locked} onChange={(e) => setForm({ ...form, reply_to: e.target.value })} />
        </div>
        <div>
          <label className={label}>Schedule a call link</label>
          <input className={input} value={form.call_url} disabled={locked} onChange={(e) => setForm({ ...form, call_url: e.target.value })} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Link href="/admin/marketing/campaigns" className={btnGhost}>Cancel</Link>
        <button type="button" className={btn} disabled={saving || locked || !form.name.trim() || !form.from_email.trim()} onClick={save}>
          {saving ? "Saving…" : "Next: founder list"}
        </button>
      </div>
    </div>
  );
}

// ── 2. Founder list ──────────────────────────────────────────────────────────

function toFilter(listId: string, s: SearchState): FounderFilterInput {
  return {
    list: listId || null,
    types: s.quick.filter((k): k is FounderType => k === "lead" || k === "existing_user" || k === "in_pipeline"),
    filled: s.quick.includes("filled"),
    industries: s.fields.industry ?? [],
    stages: s.fields.stage ?? [],
    pipeline: s.fields.pipeline ?? [],
    q: s.q,
  };
}

function StepFounders({ campaign, lists, options, onChecked, onError }: {
  campaign: MatchCampaignRow;
  lists: ListOption[];
  options: Options;
  onChecked: (rows: CampaignFounderRow[]) => void;
  onError: (e: string) => void;
}) {
  const [listId, setListId] = useState(campaign.match_config.founder_list_id ?? "");
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [rows, setRows] = useState<FounderFieldsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const filter = useMemo(() => toFilter(listId, search), [listId, search]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      setLoading(true);
      api<{ rows: FounderFieldsRow[]; total: number }>(`/api/admin/marketing/match/founders?${filterToQuery(filter, 200)}`)
        .then((j) => { if (live) { setRows(j.rows); setTotal(j.total); setSelected(new Set()); setAllSelected(false); } })
        .catch((e) => live && onError(String(e.message)))
        .finally(() => live && setLoading(false));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [filter, onError]);

  const count = allSelected ? Math.min(total, MAX_CAMPAIGN_FOUNDERS) : selected.size;

  async function useSelection() {
    setBusy(true);
    try {
      const j = await api<{ founders: CampaignFounderRow[] }>("/api/admin/marketing/match/check", {
        method: "POST",
        body: JSON.stringify({ campaign_id: campaign.id, filter, ...(allSelected ? { select_all: true } : { founder_ids: [...selected] }) }),
      });
      onChecked(j.founders);
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) => {
    setAllSelected(false);
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  return (
    <div className={card}>
      <div className="mb-1 text-[14px] font-medium">Pick the founder list</div>
      <p className="mb-4 text-[12.5px] text-[#5A6782]">Choose a saved list or filter founders directly. These founders receive the email.</p>
      <div className="mb-3 max-w-sm">
        <label className={label}>Founder list</label>
        <select className={input} value={listId} onChange={(e) => setListId(e.target.value)}>
          <option value="">All founder contacts</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}{l.count != null ? ` (${l.count})` : ""}</option>)}
        </select>
      </div>
      <div className="mb-3">
        <OdooSearchBar
          scope="match-campaign-founders"
          state={search}
          onChange={setSearch}
          quick={[
            { key: "lead", label: "Lead only" },
            { key: "existing_user", label: "Existing user" },
            { key: "in_pipeline", label: "In pipeline" },
            { key: "filled", label: "Industry and stage filled", sep: true },
          ]}
          fields={[
            { key: "industry", label: "Industry", options: options.industries },
            { key: "stage", label: "Stage", options: options.stages },
            { key: "pipeline", label: "Pipeline stage", options: options.pipelineStages },
          ]}
          groups={[]}
          placeholder="Search company, name or email…"
          applyDefault={false}
          personalOnly
        />
      </div>
      {count > 0 ? (
        <div className="mb-2">
          <SelectionBar
            count={count}
            total={Math.min(total, MAX_CAMPAIGN_FOUNDERS)}
            onSelectAll={() => setAllSelected(true)}
            onClear={() => { setSelected(new Set()); setAllSelected(false); }}
            busy={busy}
            actions={[{ key: "use", icon: "ti-arrow-right", label: "Use for this campaign", run: useSelection }]}
          />
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-[#E3E8F2]">
        <table className="w-full">
          <thead className="bg-[#F7F9FC]">
            <tr>
              <th className={th}>
                <input
                  type="checkbox"
                  aria-label="Select all shown"
                  checked={rows.length > 0 && (allSelected || rows.every((r) => selected.has(r.id)))}
                  onChange={(e) => { setAllSelected(false); setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set()); }}
                />
              </th>
              <th className={th}>Company</th><th className={th}>Founder type</th><th className={th}>Pipeline stage</th><th className={th}>Industry</th><th className={th}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#E3E8F2]">
                <td className={td}><input type="checkbox" aria-label={`Select ${r.company ?? r.name ?? ""}`} checked={allSelected || selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className={td}><div className="font-medium">{r.company || r.name || "—"}</div><div className="text-[11px] text-[#8A94A8]">{r.email ?? "No email"}</div></td>
                <td className={td}>{FOUNDER_TYPE_LABEL[r.founder_type]}</td>
                <td className={td}>{r.pipeline_stage ?? (r.founder_type === "in_pipeline" ? "—" : "Not in pipeline")}</td>
                <td className={td}>{(r.industries ?? []).length ? (r.industries ?? []).join(", ") : <NotFilled />}</td>
                <td className={td}>{(r.funding_stages ?? []).length ? (r.funding_stages ?? []).join(", ") : <NotFilled />}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? <tr><td className={`${td} text-[#8A94A8]`} colSpan={6}>No founders fit these filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11.5px] text-[#8A94A8]">{loading ? "Loading…" : `Showing ${rows.length} of ${total.toLocaleString()} founders. Select all takes every founder that fits, up to ${MAX_CAMPAIGN_FOUNDERS.toLocaleString()}.`}</div>
      <div className="mt-5 flex justify-end">
        <button type="button" className={btn} disabled={busy || count === 0} onClick={useSelection}>{busy ? "Checking…" : `Next: data check (${count})`}</button>
      </div>
    </div>
  );
}

// ── 3. Data check ────────────────────────────────────────────────────────────

function summarize(founders: CampaignFounderRow[]) {
  const r = { selected: founders.length, ready: 0, missing: 0, email: 0, recent: 0, other: 0 };
  for (const f of founders) {
    const x = f.excluded_reason;
    if (!x || x === "no_matches") r.ready++;
    else if (x === "missing_industry" || x === "missing_stage" || x === "unconfirmed_data") r.missing++;
    else if (x === "email_unverified" || x === "invalid_email" || x === "no_email") r.email++;
    else if (x === "emailed_recently") r.recent++;
    else r.other++;
  }
  return r;
}

function StepCheck({ campaign, founders, sequenceEnabled, onChange, onCampaign, onNext, onError }: {
  campaign: MatchCampaignRow;
  founders: CampaignFounderRow[];
  sequenceEnabled: boolean;
  onChange: (c: MatchCampaignRow, rows: CampaignFounderRow[]) => void;
  onCampaign: (c: MatchCampaignRow) => void;
  onNext: () => void;
  onError: (e: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(String(campaign.match_config.cooldown_days));
  const s = summarize(founders);

  async function setOption(patch: Partial<MatchConfig>) {
    setBusy(true);
    try {
      const { campaign: c } = await api<{ campaign: MatchCampaignRow }>("/api/admin/marketing/match", { method: "PATCH", body: JSON.stringify({ id: campaign.id, config: patch }) });
      const j = await api<{ founders: CampaignFounderRow[] }>("/api/admin/marketing/match/check", { method: "POST", body: JSON.stringify({ campaign_id: campaign.id, recheck: true }) });
      onChange(c, j.founders);
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <div className="mb-1 text-[14px] font-medium">Data check</div>
      <p className="mb-4 text-[12.5px] text-[#5A6782]">Only founders with industry and stage filled can be matched. Data is filled by the team separately; this step only checks it.</p>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Tile value={s.selected} label="Founders selected" />
        <Tile value={s.ready} label="Ready to match" tone="good" />
        <Tile value={s.missing} label="Missing or guessed industry or stage" tone="warn" />
        <Tile value={s.email} label="Email unverified or invalid" tone="warn" />
        <Tile value={s.recent} label="Emailed recently" tone="warn" />
        <Tile value={s.other} label="Unsubscribed or EU" tone="warn" />
      </div>
      <div className="mb-4 flex flex-wrap gap-5 text-[12.5px]">
        <label className="flex items-center gap-2">
          <input type="checkbox" disabled={busy} checked={campaign.match_config.verified_only} onChange={(e) => setOption({ verified_only: e.target.checked })} />
          Send only to verified emails
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" disabled={busy} checked={campaign.match_config.exclude_eu} onChange={(e) => setOption({ exclude_eu: e.target.checked })} />
          Exclude EU, UK and Swiss leads
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" disabled={busy} checked={campaign.match_config.include_inferred} onChange={(e) => setOption({ include_inferred: e.target.checked })} />
          Include low-confidence industry and guessed stages
        </label>
        <label className="flex flex-wrap items-center gap-2">
          <input type="checkbox" disabled={busy} checked={campaign.match_config.cooldown_enabled} onChange={(e) => setOption({ cooldown_enabled: e.target.checked })} />
          Hold back founders emailed by another Match campaign in the last
          <input
            type="number"
            min={1}
            max={365}
            aria-label="Cooldown days"
            className="h-7 w-16 rounded-md border border-[#E3E8F2] px-2 text-[12.5px]"
            disabled={busy || !campaign.match_config.cooldown_enabled}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            onBlur={() => {
              const n = Math.min(365, Math.max(1, Math.round(Number(days) || 0)));
              if (!n || n === campaign.match_config.cooldown_days) { setDays(String(campaign.match_config.cooldown_days)); return; }
              setDays(String(n));
              void setOption({ cooldown_days: n });
            }}
          />
          days
        </label>
      </div>
      <div className="max-h-[420px] overflow-auto rounded-lg border border-[#E3E8F2]">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#F7F9FC]"><tr><th className={th}>Company</th><th className={th}>Industry</th><th className={th}>Stage</th><th className={th}>Email</th><th className={th}>Status</th></tr></thead>
          <tbody>
            {founders.map((f) => (
              <tr key={f.id} className="border-t border-[#E3E8F2]">
                <td className={td}>{f.company ?? "—"}</td>
                <td className={td}>{f.industry ?? <NotFilled />}</td>
                <td className={td}>{f.funding_stage ?? <NotFilled />}</td>
                <td className={td}>{f.email ?? "—"}</td>
                <td className={td}>
                  {!f.excluded_reason || f.excluded_reason === "no_matches"
                    ? <span className="font-medium text-[#0F6E56]">Ready</span>
                    : <span className="text-[#854F0B]">Excluded, {f.excluded_reason === "emailed_recently" && f.excluded_note ? f.excluded_note.charAt(0).toLowerCase() + f.excluded_note.slice(1) : EXCLUDED_LABEL[f.excluded_reason].toLowerCase()}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-[#8A94A8]">Excluded founders stay on the list and can join a later campaign once their data is filled. The cooldown counts real emails only, not test mode, and is checked again right before each send.</p>
      {sequenceEnabled && campaign.match_config.sequence_enabled ? <CohortPanel campaign={campaign} founders={founders} onCampaign={onCampaign} onError={onError} /> : null}
      <div className="mt-5 flex justify-end">
        <button type="button" className={btn} disabled={busy || s.ready === 0} onClick={onNext}>Next: matches</button>
      </div>
    </div>
  );
}

// ── 4. Matches ───────────────────────────────────────────────────────────────

function StepMatches({ campaign, founders, onFounders, onCampaign, onNext, onError }: {
  campaign: MatchCampaignRow;
  founders: CampaignFounderRow[];
  onFounders: (rows: CampaignFounderRow[]) => void;
  onCampaign: (c: MatchCampaignRow) => void;
  onNext: () => void;
  onError: (e: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, AdminMatchRow[]>>({});
  const [minScore, setMinScore] = useState(campaign.match_config.min_score);
  const pending = founders.filter((f) => f.send_status === "pending");
  const ready = pending.filter((f) => !f.excluded_reason || f.excluded_reason === "no_matches");
  const withMatches = ready.filter((f) => f.match_count > 0);
  const noMatches = ready.filter((f) => f.excluded_reason === "no_matches");

  async function run() {
    setRunning(true);
    try {
      if (minScore !== campaign.match_config.min_score) {
        const c = await api<{ campaign: MatchCampaignRow }>("/api/admin/marketing/match", { method: "PATCH", body: JSON.stringify({ id: campaign.id, config: { min_score: minScore } }) });
        onCampaign(c.campaign);
      }
      // Matching runs in batches; repeat until the server says it's done.
      const total: RunSummary = { ready: 0, withMatches: 0, noMatches: 0, investors: 0 };
      let after: string | null = null;
      let done = 0;
      let founders: CampaignFounderRow[] | null = null;
      setProgress({ done: 0, total: ready.length });
      do {
        const j: RunBatch & { founders: CampaignFounderRow[] | null } = await api("/api/admin/marketing/match/run", { method: "POST", body: JSON.stringify({ campaign_id: campaign.id, after }) });
        total.ready = j.summary.ready;
        total.investors = j.summary.investors;
        total.withMatches += j.summary.withMatches;
        total.noMatches += j.summary.noMatches;
        done += j.processed;
        setProgress({ done, total: j.summary.ready });
        after = j.next;
        founders = j.founders;
      } while (after);
      setSummary(total);
      setMatches({});
      if (founders) onFounders(founders);
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  async function expand(id: string) {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    if (!matches[id]) {
      try {
        const j = await api<{ matches: AdminMatchRow[] }>(`/api/admin/marketing/match/run?founder=${id}`);
        setMatches((m) => ({ ...m, [id]: j.matches }));
      } catch (e) {
        onError(String((e as Error).message));
      }
    }
  }

  async function remove(founderId: string, matchId: string, hide = false) {
    if (hide && !window.confirm("Hide this investor from every founder? Future matching runs will skip them.")) return;
    try {
      const j = await api<{ match_count: number }>("/api/admin/marketing/match/run", { method: "PATCH", body: JSON.stringify({ match_id: matchId, hide }) });
      setMatches((m) => ({ ...m, [founderId]: (m[founderId] ?? []).filter((x) => x.id !== matchId) }));
      onFounders(founders.map((f) => (f.id === founderId ? { ...f, match_count: j.match_count, excluded_reason: j.match_count > 0 ? null : "no_matches" } : f)));
    } catch (e) {
      onError(String((e as Error).message));
    }
  }

  const hasRun = withMatches.length > 0 || noMatches.length > 0;

  return (
    <div className={card}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[14px] font-medium">Matches per founder</div>
        <button type="button" className={hasRun ? btnGhost : btn} disabled={running || ready.length === 0} onClick={run}>{running ? (progress && progress.total > 0 ? `Matching… ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}` : "Matching…") : hasRun ? "Run matching again" : "Run matching"}</button>
      </div>
      <p className="mb-4 text-[12.5px] text-[#5A6782]">Each ready founder is matched to investors on industry and stage, counting only investors at or above the minimum match score. Admin reviews and removes anyone. Investors are not contacted. Running again replaces earlier matches and removals.</p>
      <div className="mb-4 flex items-center gap-2 text-[12.5px]">
        <label htmlFor="min-score">Minimum match score</label>
        <input id="min-score" className={`${input} w-20`} type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
        <span className="text-[#8A94A8]">%. Changing it takes effect when you run matching.</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={ready.length} label="Founders ready" />
        <Tile value={hasRun ? withMatches.length : null} label="With 1 or more matches" tone="good" />
        <Tile value={hasRun ? noMatches.length : null} label="No matches, skipped" tone="warn" />
        <Tile value={hasRun ? withMatches.length : null} label="Founders will be emailed" />
      </div>
      {summary ? <p className="mb-3 text-[11.5px] text-[#8A94A8]">Scored against {summary.investors.toLocaleString("en-US")} investor contacts. Up to 50 matches per founder are kept for review; the count is the full number.</p> : null}
      <div className="space-y-2">
        {withMatches.map((f) => (
          <div key={f.id} className="rounded-lg border border-[#E3E8F2]">
            <button type="button" onClick={() => expand(f.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span><span className="text-[13px] font-semibold">{f.company}</span> <span className="text-[12px] text-[#5A6782]">{[f.industry, f.funding_stage].filter(Boolean).join(" · ")}</span></span>
              <span className="text-[12.5px] font-semibold text-[#1A6CE4]">{f.match_count} matches {open === f.id ? "▾" : "▸"}</span>
            </button>
            {open === f.id ? (
              <div className="overflow-x-auto border-t border-[#E3E8F2]">
                <table className="w-full">
                  <thead className="bg-[#F7F9FC]"><tr><th className={th}>Investor (admin view)</th><th className={th}>Type</th><th className={th}>Sector</th><th className={th}>Stage fit</th><th className={th}>Match</th><th className={th}></th></tr></thead>
                  <tbody>
                    {(matches[f.id] ?? []).map((m) => (
                      <tr key={m.id} className="border-t border-[#E3E8F2]">
                        <td className={td}><div className="font-medium">{m.investor_company || m.investor_name || "—"}</div>{m.investor_company && m.investor_name ? <div className="text-[11px] text-[#8A94A8]">{m.investor_name}</div> : null}</td>
                        <td className={td}>{m.investor_type ?? "—"}</td>
                        <td className={td}>{(m.matched_sectors?.length ? m.matched_sectors : m.sectors.slice(0, 3)).join(", ") || "—"}{m.sector_tier ? <div className="text-[11px] text-[#8A94A8]">{m.sector_tier === "exact" ? "Exact fit" : m.sector_tier === "adjacent" ? "Adjacent fit" : "Generalist"}</div> : null}</td>
                        <td className={td}>{m.stages.join(", ") || "—"}</td>
                        <td className={`${td} font-semibold`}>{m.match_score}%</td>
                        <td className={td}><button type="button" className="text-[12px] text-[#A32D2D] hover:underline" disabled={f.send_status !== "pending"} onClick={() => remove(f.id, m.id)}>Remove</button><button type="button" className="ml-3 text-[12px] text-[#5A6782] hover:underline" disabled={f.send_status !== "pending"} title="Hide this investor from every founder" onClick={() => remove(f.id, m.id, true)}>Hide everywhere</button></td>
                      </tr>
                    ))}
                    {!matches[f.id] ? <tr><td className={`${td} text-[#8A94A8]`} colSpan={6}>Loading…</td></tr> : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ))}
        {noMatches.length ? <p className="text-[12px] text-[#8A94A8]">No matches, skipped: {noMatches.map((f) => f.company).join(", ")}</p> : null}
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" className={btn} disabled={withMatches.length === 0} onClick={onNext}>Next: content</button>
      </div>
    </div>
  );
}

// ── 5. Content ───────────────────────────────────────────────────────────────

function StepContent({ campaign, founders, sequenceEnabled, onCampaign, onNext, onError }: {
  campaign: MatchCampaignRow;
  founders: CampaignFounderRow[];
  sequenceEnabled: boolean;
  onCampaign: (c: MatchCampaignRow) => void;
  onNext: () => void;
  onError: (e: string) => void;
}) {
  const candidates = founders.filter((f) => f.match_count > 0);
  const [subject, setSubject] = useState(campaign.subject_override ?? "");
  const [founderId, setFounderId] = useState(candidates[0]?.id ?? "");
  const [view, setView] = useState<"email" | "page">("email");
  const [preview, setPreview] = useState<{ subject: string; html: string; matchPagePath: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!founderId) return;
    api<{ subject: string; html: string; matchPagePath: string }>(`/api/admin/marketing/match/preview?campaign_id=${campaign.id}&founder_id=${founderId}`)
      .then(setPreview)
      .catch((e) => onError(String(e.message)));
  }, [campaign.id, campaign.subject_override, founderId, onError]);

  async function setLayout(config: Partial<MatchConfig>) {
    try {
      const j = await api<{ campaign: MatchCampaignRow }>("/api/admin/marketing/match", { method: "PATCH", body: JSON.stringify({ id: campaign.id, config }) });
      onCampaign(j.campaign);
    } catch (e) {
      onError(String((e as Error).message));
    }
  }

  async function saveSubject() {
    setSaving(true);
    try {
      const j = await api<{ campaign: MatchCampaignRow }>("/api/admin/marketing/match", { method: "PATCH", body: JSON.stringify({ id: campaign.id, subject_override: subject }) });
      onCampaign(j.campaign);
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className={card}>
        <div className="mb-1 text-[14px] font-medium">Content</div>
        <p className="mb-4 text-[12.5px] text-[#5A6782]">Each founder receives their own matches. Investor names and firms show; contact details stay hidden until they choose a plan.</p>
        <label className={label}>Layout</label>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[12.5px]">
          <div className="inline-flex rounded-lg border border-[#E3E8F2] p-0.5">
            <button type="button" onClick={() => setLayout({ flow: "review" })} className={`rounded-md px-3 py-1.5 text-[12px] ${campaign.match_config.flow === "review" ? "bg-[#1A6CE4] text-white" : "text-[#5A6782]"}`}>Match review first</button>
            <button type="button" onClick={() => setLayout({ flow: "plan" })} className={`rounded-md px-3 py-1.5 text-[12px] ${campaign.match_config.flow === "plan" ? "bg-[#1A6CE4] text-white" : "text-[#5A6782]"}`}>Plan first</button>
          </div>
          {campaign.match_config.flow === "review" ? (
            <span className="flex items-center gap-2 text-[#5A6782]">
              Open matches by name
              <select className={`${input} w-16`} value={campaign.match_config.visible_count} onChange={(e) => setLayout({ visible_count: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              the rest show as locked
            </span>
          ) : null}
        </div>
        <p className="-mt-1 mb-4 text-[11px] text-[#8A94A8]">Match review first: one button to book a free 15 minute match review on live availability, plan as the secondary path, no match %. Plan first: the original layout. Run one campaign of each to compare bookings and plan starts on Results.</p>
        <label className={label}>Subject</label>
        <div className="mb-3 flex gap-2">
          <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <button type="button" className={btnGhost} disabled={saving || subject === (campaign.subject_override ?? "")} onClick={saveSubject}>{saving ? "Saving…" : "Save"}</button>
        </div>
        <p className="-mt-2 mb-3 text-[11px] text-[#8A94A8]">{"{match_count}"} and {"{company}"} fill in per founder. Keep the subject a plain description of the email.</p>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className={label}>Preview founder</label>
            <select className={input} value={founderId} onChange={(e) => setFounderId(e.target.value)}>
              {candidates.map((f) => <option key={f.id} value={f.id}>{f.company} ({f.match_count})</option>)}
            </select>
          </div>
          <div className="inline-flex rounded-lg border border-[#E3E8F2] p-0.5">
            <button type="button" onClick={() => setView("email")} className={`rounded-md px-3 py-1.5 text-[12px] ${view === "email" ? "bg-[#1A6CE4] text-white" : "text-[#5A6782]"}`}>Founder email</button>
            <button type="button" onClick={() => setView("page")} className={`rounded-md px-3 py-1.5 text-[12px] ${view === "page" ? "bg-[#1A6CE4] text-white" : "text-[#5A6782]"}`}>Match page (click to expand)</button>
          </div>
        </div>
        {preview ? (
          <>
            {view === "email" ? <div className="mb-2 text-[12px] text-[#5A6782]"><b>Subject:</b> {preview.subject}</div> : null}
            <iframe
              title={view === "email" ? "Founder email preview" : "Match page preview"}
              className="h-[640px] w-full rounded-lg border border-[#E3E8F2] bg-white"
              {...(view === "email" ? { srcDoc: preview.html } : { src: preview.matchPagePath })}
            />
          </>
        ) : <div className="text-[12px] text-[#8A94A8]">Loading preview…</div>}
        <div className="mt-5 flex justify-end"><button type="button" className={btn} onClick={onNext}>{sequenceEnabled ? "Next: sequence" : "Next: schedule"}</button></div>
      </div>
      <div className={`${card} h-fit text-[12.5px] leading-5`}>
        <div className="mb-2 font-semibold">What the founder sees before paying</div>
        <ul className="mb-4 space-y-1 text-[#5A6782]">
          <li>+ Match count and top {campaign.match_config.preview_count} matches: investor name and firm, {campaign.match_config.flow === "review" ? "what each matched on" : "type, sector, stage fit, match %"}</li>
          <li>− Contact details (email, phone, LinkedIn) hidden</li>
          <li>= Existing footer with unsubscribe and suppression</li>
        </ul>
        <div className="mb-2 font-semibold">Buttons</div>
        {sequenceEnabled && campaign.match_config.sequence_enabled ? (
          <p className="mb-2 rounded-lg bg-[#F3F8FF] p-2 text-[#1A6CE4]">Follow ups are on: the email has one button, See my matches, plus the warm intro line. Schedule a call and Choose a plan move to the match page.</p>
        ) : null}
        <ul className="space-y-1 text-[#5A6782]">
          <li>• See all matches: the founder&apos;s match page; each match expands like icapos.com/fit, contact info hidden</li>
          <li>1. Schedule a call with us: the scheduling page</li>
          <li>2. Choose a plan to unlock: /start to choose a plan</li>
          <li>3. After paying, names show under Investor matches in their workspace, and Request introduction goes to the existing brokered introductions queue for admin approval</li>
        </ul>
      </div>
    </div>
  );
}

// ── 6. Schedule ──────────────────────────────────────────────────────────────

function StepSchedule({ campaign, founders, resendReady, sequenceEnabled, onCampaign, onDone, onError }: {
  campaign: MatchCampaignRow;
  founders: CampaignFounderRow[];
  resendReady: boolean;
  sequenceEnabled: boolean;
  onCampaign: (c: MatchCampaignRow) => void;
  onDone: () => void;
  onError: (e: string) => void;
}) {
  const zones = useMemo(() => timeZones(), []);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles");
  const [cap, setCap] = useState(campaign.match_config.daily_cap);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const recipients = founders.filter((f) => f.send_status === "pending" && !f.excluded_reason && f.match_count > 0).length;
  const dry = campaign.match_config.dry_run;

  async function patch(config: Partial<MatchConfig>) {
    const j = await api<{ campaign: MatchCampaignRow }>("/api/admin/marketing/match", { method: "PATCH", body: JSON.stringify({ id: campaign.id, config }) });
    onCampaign(j.campaign);
  }

  async function act(action: "test" | "schedule" | "send_now") {
    setBusy(action);
    setNote(null);
    try {
      if (cap !== campaign.match_config.daily_cap) await patch({ daily_cap: cap });
      if (action === "test") {
        const r = await api<{ ok: boolean; to: string; error?: string }>("/api/admin/marketing/match/send", { method: "POST", body: JSON.stringify({ campaign_id: campaign.id, action: "test" }) });
        setNote(r.ok ? `Test sent to ${r.to}.` : `Test failed: ${r.error}`);
        return;
      }
      if (action === "schedule") {
        const at = zonedToUtc(date, time, tz);
        if (!at) throw new Error("Pick a send date and time.");
        await api("/api/admin/marketing/match/send", { method: "POST", body: JSON.stringify({ campaign_id: campaign.id, action: "schedule", scheduled_at: at }) });
        setNote(`Scheduled for ${date} ${time} (${tz}). The campaign cron sends it, up to ${cap} a day.`);
        onDone();
        return;
      }
      const r = await api<{ sent: number; skipped: number; failed: number }>("/api/admin/marketing/match/send", { method: "POST", body: JSON.stringify({ campaign_id: campaign.id, action: "send_now" }) });
      setNote(`${dry ? "Recorded (test mode, no email sent)" : "Sent"}: ${r.sent}. Skipped: ${r.skipped}. Failed: ${r.failed}.`);
      onDone();
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={card}>
      <div className="mb-1 text-[14px] font-medium">Schedule and send</div>
      <p className="mb-4 text-[12.5px] text-[#5A6782]">Same scheduling as any campaign. Founders over the daily cap go out on the next day&apos;s pass.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div><label className={label}>Send date</label><input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className={label}>Send time</label><input className={input} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div><label className={label}>Daily send cap</label><input className={input} type="number" min={1} value={cap} onChange={(e) => setCap(Math.max(1, Number(e.target.value) || 1))} /></div>
        <div><label className={label}>Time zone</label><select className={input} value={tz} onChange={(e) => setTz(e.target.value)}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select></div>
      </div>
      <label className="mt-4 flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={dry} onChange={(e) => patch({ dry_run: e.target.checked }).catch((err) => onError(String(err.message)))} />
        Test mode: record sends without emailing founders
      </label>
      <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg bg-[#F7F9FC] p-4 text-[12.5px] sm:grid-cols-2">
        <div>Campaign type: <b>Match</b></div>
        <div>Founder recipients: <b>{recipients}</b></div>
        <div>Investors emailed: <b>0</b></div>
        <div>Template: <b>Founder match email, contact details hidden</b></div>
        <div>Status: <b>{campaign.status}</b>{campaign.scheduled_at ? ` · ${new Date(campaign.scheduled_at).toLocaleString()}` : ""}</div>
        <div>Mode: <b>{dry ? "Test mode, no founder emails" : "Live"}</b></div>
        {sequenceEnabled ? (
          <div className="sm:col-span-2">
            Follow ups: <b>{campaign.match_config.sequence_enabled ? `On, ${campaign.match_config.holdout_pct}% holdout gets the single email` : "Off, single email"}</b>
            {campaign.match_config.sequence_enabled && dry ? " · test mode records follow ups and call tasks without sending or creating them" : ""}
          </div>
        ) : null}
      </div>
      {!resendReady && !dry ? <p className="mt-3 text-[12px] text-[#854F0B]">Email provider not connected. Live sends are held until RESEND_API_KEY is set.</p> : null}
      {note ? <p className="mt-3 text-[12.5px] text-[#0F6E56]">{note}</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => act("test")}>{busy === "test" ? "Sending…" : "Send test to me"}</button>
        <button type="button" className={btnGhost} disabled={busy !== null || recipients === 0} onClick={() => act("send_now")}>{busy === "send_now" ? "Sending…" : "Send today's batch now"}</button>
        <button type="button" className={btn} disabled={busy !== null || recipients === 0 || !date} onClick={() => act("schedule")}>{busy === "schedule" ? "Scheduling…" : "Schedule campaign"}</button>
      </div>
    </div>
  );
}

// ── 7. Results ───────────────────────────────────────────────────────────────

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function StepResults({ campaign, sequenceEnabled, onCampaign, onError }: { campaign: MatchCampaignRow; sequenceEnabled: boolean; onCampaign: (c: MatchCampaignRow) => void; onError: (e: string) => void }) {
  const [r, setR] = useState<MatchResults | null>(null);
  const [cost, setCost] = useState({
    send: campaign.match_config.cost?.send_cost_usd?.toString() ?? "",
    hours: campaign.match_config.cost?.admin_hours?.toString() ?? "",
    rate: campaign.match_config.cost?.hourly_rate_usd?.toString() ?? "",
  });
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    api<MatchResults>(`/api/admin/marketing/match/results?campaign_id=${campaign.id}`).then(setR).catch((e) => onError(String(e.message)));
  }, [campaign.id, onError]);
  useEffect(load, [load]);

  async function saveCost() {
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    try {
      const j = await api<{ campaign: MatchCampaignRow }>("/api/admin/marketing/match", {
        method: "PATCH",
        body: JSON.stringify({ id: campaign.id, config: { cost: { send_cost_usd: num(cost.send), admin_hours: num(cost.hours), hourly_rate_usd: num(cost.rate) } } }),
      });
      onCampaign(j.campaign);
      load();
    } catch (e) {
      onError(String((e as Error).message));
    }
  }

  // Uses the existing admin intro endpoints, so their notifications to founders apply.
  async function decide(kind: "prospect" | "member", id: string, decision: "introduce" | "hold" | "decline") {
    setActing(id);
    try {
      if (kind === "prospect") {
        if (decision === "hold") return; // stays "new" in the brokered queue
        await api(`/api/admin/prospect-intros/${id}`, { method: "POST", body: JSON.stringify({ status: decision === "introduce" ? "contacted" : "dismissed" }) });
      } else {
        const status = decision === "introduce" ? "facilitated" : decision === "hold" ? "reviewing" : "declined";
        await api(`/api/admin/intro-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      }
      load();
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setActing(null);
    }
  }

  if (!r) return <div className={card}><div className="text-[12.5px] text-[#8A94A8]">Loading results…</div></div>;
  const funnel: Array<[string, number | null]> = [
    ["Founders emailed", r.emailed || null],
    ["Opened", r.opened],
    ["Opened match page", r.pageOpened],
    ...(campaign.match_config.flow === "review" ? ([["Viewed an investor profile", r.profileViewed]] as Array<[string, number | null]>) : []),
    [campaign.match_config.flow === "review" ? "Clicked Pick a time" : "Clicked Schedule a call", r.callClicks],
    [campaign.match_config.flow === "review" ? "Booked a match review" : "Booked a call", r.booked],
    ["Clicked Choose a plan", r.introClicks],
    ["Chose a plan", r.plans],
    ["Requested introduction", r.introsRequested],
    ["Introduced", r.introduced],
  ];
  const rate = (n: number | null) => (n != null && r.emailed > 0 ? ` (${Math.round((n / r.emailed) * 100)}%)` : "");

  return (
    <div className="space-y-4">
      {sequenceEnabled && campaign.match_config.sequence_enabled ? <SequenceResultsCard campaign={campaign} onError={onError} /> : null}
      <div className={card}>
        <div className="mb-1 text-[14px] font-medium">Results</div>
        <p className="mb-4 text-[12.5px] text-[#5A6782]">Regular campaign stats, plus the founder funnel and introductions to approve. Blank until real data comes in. No projected figures shown.</p>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile value={r.emailed || null} label="Founders emailed" />
          <Tile value={r.booked} label="Booked a call" />
          <Tile value={r.plans} label="Chose a plan" tone="good" />
          <Tile value={r.revenueCents != null ? `${money(r.revenueCents)}${r.roi != null ? ` · ${Math.round(r.roi * 100)}%` : ""}` : null} label="Revenue · ROI" />
        </div>
        {r.dryRun > 0 ? <p className="mb-3 text-[12px] text-[#854F0B]">{r.dryRun} founder{r.dryRun === 1 ? "" : "s"} recorded in test mode (no email sent); they count in the funnel.</p> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[12.5px] font-semibold">Founder funnel</div>
            <table className="w-full rounded-lg border border-[#E3E8F2]">
              <tbody>
                {funnel.map(([k, v]) => (
                  <tr key={k} className="border-t border-[#E3E8F2] first:border-t-0"><td className={td}>{k}</td><td className={`${td} text-right font-semibold`}>{v ?? "—"}{k !== "Founders emailed" ? rate(v) : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-semibold">Campaign cost (for ROI)</div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className={label}>Email send cost ($)</label><input className={input} inputMode="decimal" value={cost.send} onChange={(e) => setCost({ ...cost, send: e.target.value })} /></div>
              <div><label className={label}>Admin hours</label><input className={input} inputMode="decimal" value={cost.hours} onChange={(e) => setCost({ ...cost, hours: e.target.value })} /></div>
              <div><label className={label}>Hourly rate ($)</label><input className={input} inputMode="decimal" value={cost.rate} onChange={(e) => setCost({ ...cost, rate: e.target.value })} /></div>
            </div>
            <button type="button" className={`${btnGhost} mt-2`} onClick={saveCost}>Save cost</button>
            <p className="mt-2 text-[11px] text-[#8A94A8]">ROI = (plan revenue from converted founders in their first 90 days, billed to date, minus cost) ÷ cost. Plans count when started after the founder was emailed.</p>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="mb-2 text-[12.5px] font-semibold">Breakdown</div>
        <div className="grid gap-4 md:grid-cols-3">
          {([["Founder type", r.byFounderType], ["Industry", r.byIndustry], ["Stage", r.byStage]] as const).map(([title, rows]) => (
            <table key={title} className="w-full rounded-lg border border-[#E3E8F2]">
              <thead className="bg-[#F7F9FC]"><tr><th className={th}>{title}</th><th className={th}>Emailed</th><th className={th}>Plans</th></tr></thead>
              <tbody>{rows.map((b) => <tr key={b.key} className="border-t border-[#E3E8F2]"><td className={td}>{b.key}</td><td className={td}>{b.emailed}</td><td className={td}>{b.converted || "—"}</td></tr>)}</tbody>
            </table>
          ))}
        </div>
      </div>

      <div className={card}>
        <div className="mb-2 text-[12.5px] font-semibold">Introductions to approve</div>
        {r.introsToApprove.length === 0 ? (
          <p className="text-[12px] text-[#8A94A8]">None yet. Requests from this campaign&apos;s founders appear here and in the existing introductions queues.</p>
        ) : (
          <table className="w-full rounded-lg border border-[#E3E8F2]">
            <thead className="bg-[#F7F9FC]"><tr><th className={th}>Founder</th><th className={th}>Investor</th><th className={th}>Plan</th><th className={th}></th></tr></thead>
            <tbody>
              {r.introsToApprove.map((i) => (
                <tr key={i.id} className="border-t border-[#E3E8F2]">
                  <td className={td}>{i.company ?? "—"}</td>
                  <td className={td}>{i.investor ?? "—"}</td>
                  <td className={`${td} capitalize`}>{i.plan ?? "—"}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <button type="button" className="mr-2 text-[12px] font-semibold text-[#0F6E56] hover:underline" disabled={acting === i.id} onClick={() => decide(i.kind, i.id, "introduce")}>Introduce</button>
                    <button type="button" className="mr-2 text-[12px] text-[#5A6782] hover:underline" disabled={acting === i.id || i.kind === "prospect"} title={i.kind === "prospect" ? "Brokered requests stay in the queue until you introduce or decline" : undefined} onClick={() => decide(i.kind, i.id, "hold")}>Hold</button>
                    <button type="button" className="text-[12px] text-[#A32D2D] hover:underline" disabled={acting === i.id} onClick={() => decide(i.kind, i.id, "decline")}>Decline</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Follow up sequence (MATCH_SEQUENCE_ENABLED) ──────────────────────────────

async function patchConfig(campaignId: string, config: Partial<MatchConfig>): Promise<MatchCampaignRow> {
  const j = await api<{ campaign: MatchCampaignRow }>("/api/admin/marketing/match", { method: "PATCH", body: JSON.stringify({ id: campaignId, config }) });
  return j.campaign;
}

/** Inside Data check: cohorts of at most N founders and the holdout split, as they will be assigned at send. */
function CohortPanel({ campaign, founders, onCampaign, onError }: {
  campaign: MatchCampaignRow;
  founders: CampaignFounderRow[];
  onCampaign: (c: MatchCampaignRow) => void;
  onError: (e: string) => void;
}) {
  const cfg = campaign.match_config;
  const [data, setData] = useState<{ cohorts: CohortSummaryRow[]; cap: number; holdoutPct: number } | null>(null);
  const [cap, setCap] = useState(cfg.cohort_cap);
  const [holdout, setHoldout] = useState(cfg.holdout_pct);
  const [busy, setBusy] = useState(false);
  const matched = founders.some((f) => f.match_count > 0);

  const load = useCallback(() => {
    api<{ cohorts: CohortSummaryRow[]; cap: number; holdoutPct: number }>(`/api/admin/marketing/match/cohorts?campaign_id=${campaign.id}`)
      .then(setData)
      .catch((e) => onError(String(e.message)));
  }, [campaign.id, onError]);
  useEffect(load, [load, founders, cfg.cohort_cap, cfg.holdout_pct, cfg.excluded_cohorts.length]);

  async function save(patch: Partial<MatchConfig>) {
    setBusy(true);
    try {
      onCampaign(await patchConfig(campaign.id, patch));
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  function toggle(key: string, include: boolean) {
    const next = include ? cfg.excluded_cohorts.filter((k) => k !== key) : [...cfg.excluded_cohorts, key];
    void save({ excluded_cohorts: next });
  }

  return (
    <div className="mt-5 rounded-lg border border-[#E3E8F2] p-4">
      <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold">
        Cohorts <span className="rounded bg-[#FFF4E0] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#8A5A00]">New</span>
      </div>
      <p className="mb-3 text-[12px] text-[#5A6782]">
        Founders are grouped by industry, stage and region. Cohorts larger than the cap split into numbered parts. The holdout part of each cohort gets the Day 0 email only, so Results can compare single email against the sequence.
      </p>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>Max founders per cohort (10 to 100)</label>
          <div className="flex gap-2">
            <input className={input} type="number" min={10} max={100} value={cap} onChange={(e) => setCap(Number(e.target.value) || 50)} />
            <button type="button" className={btnGhost} disabled={busy || cap === cfg.cohort_cap} onClick={() => save({ cohort_cap: cap })}>Save</button>
          </div>
        </div>
        <div>
          <label className={label}>Holdout, single email only (0 to 90%)</label>
          <div className="flex gap-2">
            <input className={input} type="number" min={0} max={90} value={holdout} onChange={(e) => setHoldout(Number(e.target.value) || 0)} />
            <button type="button" className={btnGhost} disabled={busy || holdout === cfg.holdout_pct} onClick={() => save({ holdout_pct: holdout })}>Save</button>
          </div>
        </div>
        <div className="text-[11.5px] text-[#8A94A8]">
          Assigned when the campaign sends; reruns never reshuffle a founder. 0% turns the split test off.
        </div>
      </div>
      {!matched ? (
        <p className="text-[12px] text-[#8A94A8]">Cohorts list founders that have matches. Run matching in the next step, then come back to review them.</p>
      ) : !data ? (
        <p className="text-[12px] text-[#8A94A8]">Loading cohorts…</p>
      ) : data.cohorts.length === 0 ? (
        <p className="text-[12px] text-[#8A94A8]">No unsent founders with matches.</p>
      ) : (
        <div className="max-h-[320px] overflow-auto rounded-lg border border-[#E3E8F2]">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#F7F9FC]">
              <tr><th className={th}>Include</th><th className={th}>Cohort</th><th className={th}>Founders</th><th className={th}>Avg matches</th><th className={th}>Sequence</th><th className={th}>Single</th></tr>
            </thead>
            <tbody>
              {data.cohorts.map((c) => (
                <tr key={c.key} className={`border-t border-[#E3E8F2] ${c.excluded ? "opacity-50" : ""}`}>
                  <td className={td}><input type="checkbox" aria-label={`Include ${c.key}`} disabled={busy} checked={!c.excluded} onChange={(e) => toggle(c.key, e.target.checked)} /></td>
                  <td className={td}>{c.key}</td>
                  <td className={td}>{c.founders}</td>
                  <td className={td}>{c.avgMatches}</td>
                  <td className={td}>{c.sequence}</td>
                  <td className={td}>{c.single}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** New step: the follow ups each founder gets after Day 0, by what they did. */
function StepSequence({ campaign, onCampaign, onNext, onError }: {
  campaign: MatchCampaignRow;
  onCampaign: (c: MatchCampaignRow) => void;
  onNext: () => void;
  onError: (e: string) => void;
}) {
  const on = campaign.match_config.sequence_enabled;
  const [busy, setBusy] = useState(false);
  const branch = (b: "a" | "b") => FOLLOWUP_STEPS.filter((s) => s.branch === b);

  async function setOn(v: boolean) {
    setBusy(true);
    try {
      onCampaign(await patchConfig(campaign.id, { sequence_enabled: v }));
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[14px] font-medium">Sequence</div>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" disabled={busy || campaign.status !== "draft"} checked={on} onChange={(e) => setOn(e.target.checked)} />
          Follow ups
        </label>
      </div>
      <p className="mb-4 text-[12.5px] text-[#5A6782]">
        Follow ups reply in the Day 0 thread and stop as soon as the founder requests an intro, books a call, starts a plan, replies or unsubscribes. Off: one email, exactly as before.
        {campaign.status !== "draft" ? " The campaign has started, so this setting is locked." : ""}
      </p>
      <div className={`grid gap-4 md:grid-cols-2 ${on ? "" : "opacity-50"}`}>
        {(["a", "b"] as const).map((b) => (
          <div key={b} className="rounded-lg bg-[#F7F9FC] p-4">
            <div className="mb-2 text-[12.5px] font-semibold">{b === "a" ? "Branch A · never opened the match page" : "Branch B · viewed matches, no intro, no booking"}</div>
            <ol className="space-y-2 border-l-2 border-[#E3E8F2] pl-3">
              {branch(b).map((s) => (
                <li key={s.key} className="text-[12.5px]">
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${s.channel === "call" ? "bg-[#FAEEDA] text-[#854F0B]" : "bg-[#EAF2FF] text-[#1A6CE4]"}`}>{s.channel === "call" ? "Call task" : "Email"}</span>
                  {s.label}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg bg-[#F7F9FC] p-4 text-[12.5px] sm:grid-cols-2">
        <div>Founders who open their match page move to Branch B, timed from the view.</div>
        <div>Call tasks go to the founder&apos;s Sales Hub opportunity owner, else the campaign creator.</div>
        <div>Follow up emails share the campaign&apos;s daily send cap and test mode.</div>
        <div>Holdout founders ({campaign.match_config.holdout_pct}%) get the Day 0 email only.</div>
      </div>
      <div className="mt-5 flex justify-end"><button type="button" className={btn} onClick={onNext}>Next: schedule</button></div>
    </div>
  );
}

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

function VariantCells({ v }: { v: VariantRow }) {
  return (
    <>
      <td className={td}>{v.sent}</td>
      <td className={td}>{v.pageOpened} · {pct(v.pageOpened, v.sent)}</td>
      <td className={td}>{v.booked} · {pct(v.booked, v.sent)}</td>
      <td className={td}>{v.introRequested} · {pct(v.introRequested, v.sent)}</td>
      <td className={td}>{v.plans}</td>
    </>
  );
}

/** Results: sequence against the single email holdout, follow up activity, and the Replied mark. */
function SequenceResultsCard({ campaign, onError }: { campaign: MatchCampaignRow; onError: (e: string) => void }) {
  const [r, setR] = useState<SequenceResults | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const load = useCallback(() => {
    api<SequenceResults>(`/api/admin/marketing/match/sequence?campaign_id=${campaign.id}`).then(setR).catch((e) => onError(String(e.message)));
  }, [campaign.id, onError]);
  useEffect(load, [load]);

  async function replied(id: string, value: boolean) {
    setActing(id);
    try {
      await api("/api/admin/marketing/match/sequence", { method: "POST", body: JSON.stringify({ campaign_founder_id: id, replied: value }) });
      load();
    } catch (e) {
      onError(String((e as Error).message));
    } finally {
      setActing(null);
    }
  }

  if (!r) return <div className={card}><div className="text-[12.5px] text-[#8A94A8]">Loading follow up results…</div></div>;
  const cols = ["Variant", "Sent", "Opened match page", "Booked", "Intro requested", "Plans"].map((c) => <th key={c} className={th}>{c}</th>);
  const head = <tr>{cols}</tr>;

  return (
    <div className={card}>
      <div className="mb-1 text-[14px] font-medium">Sequence vs single email</div>
      <p className="mb-3 text-[12.5px] text-[#5A6782]">Measured counts only. Booked means a booking on the scheduling page after the Day 0 email.</p>
      {!r.enoughData ? (
        <p className="mb-3 rounded-lg bg-[#FAEEDA] px-3 py-2 text-[12px] text-[#854F0B]">
          Not enough data yet: each variant needs at least {r.minPerVariant} founders sent (single {r.single.sent}, sequence {r.sequence.sent}). Read the comparison once both pass.
        </p>
      ) : null}
      <table className="mb-4 w-full rounded-lg border border-[#E3E8F2]">
        <thead className="bg-[#F7F9FC]">{head}</thead>
        <tbody>
          <tr className="border-t border-[#E3E8F2]"><td className={td}>Single email</td><VariantCells v={r.single} /></tr>
          <tr className="border-t border-[#E3E8F2]"><td className={td}>Sequence</td><VariantCells v={r.sequence} /></tr>
        </tbody>
      </table>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile value={r.followups.emails || null} label="Follow up emails sent" />
        <Tile value={r.followups.calls || null} label="Call tasks created" />
        <Tile value={r.followups.recorded || null} label="Recorded in test mode" />
        <Tile value={r.active || null} label="Still in sequence" />
        <Tile value={r.followups.failed || null} label="Failed" tone="warn" />
      </div>
      {r.stopped.length ? (
        <p className="mb-4 text-[12px] text-[#5A6782]">Stopped: {r.stopped.map((s) => `${STOP_LABEL[s.reason]} ${s.count}`).join(" · ")}</p>
      ) : null}
      {r.byCohort.length ? (
        <>
          <div className="mb-2 text-[12.5px] font-semibold">By cohort</div>
          <div className="mb-4 max-h-[320px] overflow-auto rounded-lg border border-[#E3E8F2]">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#F7F9FC]"><tr><th className={th}>Cohort</th>{cols}</tr></thead>
              <tbody>
                {r.byCohort.map((c) => (
                  <tr key={`${c.key}|${c.variant}`} className="border-t border-[#E3E8F2]">
                    <td className={td}>{c.key}</td>
                    <td className={`${td} capitalize`}>{c.variant}</td>
                    <VariantCells v={c} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {r.founders.length ? (
        <>
          <div className="mb-2 text-[12.5px] font-semibold">Founders in the sequence</div>
          <p className="mb-2 text-[11.5px] text-[#8A94A8]">Replies are not detected automatically yet. Mark a founder as replied to stop their follow ups.</p>
          <div className="max-h-[320px] overflow-auto rounded-lg border border-[#E3E8F2]">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#F7F9FC]"><tr><th className={th}>Company</th><th className={th}>Cohort</th><th className={th}>Branch</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {r.founders.map((f) => (
                  <tr key={f.id} className="border-t border-[#E3E8F2]">
                    <td className={td}>{f.company ?? "—"}</td>
                    <td className={td}>{f.cohort ?? "—"}</td>
                    <td className={td}>{f.branch ? f.branch.toUpperCase() : "—"}</td>
                    <td className={`${td} capitalize`}>{f.status ?? "—"}</td>
                    <td className={`${td} text-right`}>
                      <button type="button" className="text-[12px] text-[#1A6CE4] hover:underline disabled:opacity-50" disabled={acting === f.id} onClick={() => replied(f.id, !f.replied)}>
                        {f.replied ? "Unmark replied" : "Mark replied"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
