"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GRAINS, GRAIN_LABELS, STAGES, STAGE_COLORS, STAGE_LABELS, fmt, type CampaignFunnel, type Grain, type StageKey } from "@/components/admin/social/funnel-types";

// Founder goals, alerts, drag to reschedule and repeating posts. Used by FounderSocialClient.

const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const btnPrimary = "rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2E78F5] disabled:opacity-50";
const card = "rounded-xl border border-slate-200 bg-white p-4";
const PT = "America/Los_Angeles";

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, init);
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Network error." } as T & { error?: string } };
  }
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function ptLabel(iso: string | null, withTime = true): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PT });
  return withTime ? `${date}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: PT })} PT` : date;
}
/** "YYYY-MM-DD" of an instant in Pacific time. */
function ptDateKey(d: Date): string { return d.toLocaleDateString("en-CA", { timeZone: PT }); }
/** "HH:MM" of an instant in Pacific time. */
function ptTimeKey(d: Date): string {
  return d.toLocaleTimeString("en-GB", { timeZone: PT, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}
/** A Pacific date and time typed as "YYYY-MM-DDTHH:MM", to a UTC ISO string. */
function ptToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  for (const off of [7, 8]) {
    const cand = new Date(Date.UTC(y, mo - 1, d, h + off, mi));
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: PT, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(cand);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    if (g("year") === y && g("month") === mo && g("day") === d && g("hour") === h && g("minute") === mi) return cand.toISOString();
  }
  return null;
}

// ───────────────────────────── Goals ─────────────────────────────

function GoalPlanner({ campaignId, grain, stages, onSaved, onCancel }: {
  campaignId: string; grain: Grain; stages: CampaignFunnel["stages"]; onSaved: () => void; onCancel: () => void;
}) {
  const seed = (k: StageKey): string => {
    const s = stages.find((x) => x.stage === k);
    if (s?.target != null) return String(s.target);
    return s && s.actual > 0 ? String(Math.ceil((s.actual * 1.15) / 10) * 10) : "";
  };
  const [vals, setVals] = useState<Record<StageKey, string>>(() => Object.fromEntries(STAGES.map((k) => [k, seed(k)])) as Record<StageKey, string>);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const goals: Record<string, number | null> = {};
    for (const k of STAGES) { const n = vals[k].trim(); goals[k] = n === "" ? null : Math.max(0, Math.round(Number(n))); }
    const r = await call("/api/founder/social/goals", json("POST", { campaignId, grain, goals }));
    setBusy(false);
    if (!r.ok) { setMsg(r.data.error ?? "Could not save goals."); return; }
    onSaved();
  }

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
      <div className="text-sm font-semibold text-slate-800">Plan goals for this {grain}</div>
      <div className="mb-2 text-xs text-slate-500">Seeded from your current pace. Change any stage, or leave it blank to skip it.</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 uppercase tracking-wide"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: STAGE_COLORS[k] }} />{STAGE_LABELS[k]}</span>
            <input inputMode="numeric" value={vals[k]} onChange={(e) => setVals((p) => ({ ...p, [k]: e.target.value.replace(/[^0-9]/g, "") }))} placeholder="None" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900" />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>{busy ? "Saving" : "Save goals"}</button>
        <button type="button" className={btn} onClick={onCancel}>Cancel</button>
        {msg && <span className="text-xs text-red-700">{msg}</span>}
      </div>
    </div>
  );
}

export function GoalsPanel({ onChange }: { onChange: () => Promise<void> }) {
  const [grain, setGrain] = useState<Grain>("month");
  const [data, setData] = useState<{ grain: Grain; funnels: CampaignFunnel[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async (g: Grain) => {
    const r = await call<{ funnels: CampaignFunnel[] }>(`/api/founder/social/goals?grain=${g}`);
    setData({ grain: g, funnels: r.ok ? r.data.funnels ?? [] : [] });
  }, []);
  useEffect(() => {
    let live = true;
    void call<{ funnels: CampaignFunnel[] }>(`/api/founder/social/goals?grain=${grain}`).then((r) => {
      if (live) setData({ grain, funnels: r.ok ? r.data.funnels ?? [] : [] });
    });
    return () => { live = false; };
  }, [grain]);

  const loading = data?.grain !== grain;
  const funnels = loading ? [] : data?.funnels ?? [];

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold text-slate-900">Goals</h2>
        <div className="flex gap-1" role="group" aria-label="Goal period">
          {GRAINS.map((g) => (
            <button key={g} type="button" aria-pressed={g === grain} onClick={() => { setOpen(null); setGrain(g); }}
              className={`rounded-full border px-3 py-1 text-xs ${g === grain ? "border-[#1A6CE4] text-[#1A6CE4]" : "border-slate-300 text-slate-600"}`}>{GRAIN_LABELS[g]}</button>
          ))}
        </div>
      </div>
      {loading ? <p className="mt-3 text-sm text-slate-500">Loading</p> : funnels.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Create a campaign above, then set a goal for each stage of your funnel.</p>
      ) : funnels.map((f) => (
        <div key={f.campaignId} className="mt-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
          <div className="flex items-center gap-2">
            <span className="mr-auto text-sm font-medium text-slate-900">{f.name}</span>
            <button type="button" className={btn} onClick={() => setOpen(open === f.campaignId ? null : f.campaignId)}>{open === f.campaignId ? "Close" : "Set goals"}</button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {f.stages.map((s) => {
              const pct = s.target ? Math.min(100, Math.round((s.actual / s.target) * 100)) : null;
              return (
                <div key={s.stage}>
                  <div className="text-xs uppercase tracking-wide text-slate-500">{STAGE_LABELS[s.stage]}</div>
                  <div className="text-sm text-slate-900"><b>{fmt(s.actual)}</b>{s.target != null ? ` of ${fmt(s.target)}` : ""}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden><div className="h-1.5 rounded-full" style={{ width: `${pct ?? 0}%`, background: STAGE_COLORS[s.stage] }} /></div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{pct != null ? `${pct}% of goal` : "No goal set"}</div>
                </div>
              );
            })}
          </div>
          {open === f.campaignId && (
            <GoalPlanner campaignId={f.campaignId} grain={grain} stages={f.stages} onCancel={() => setOpen(null)}
              onSaved={() => { setOpen(null); void load(grain); void onChange(); }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── Alerts ─────────────────────────────

type Rule = { id: string; metric: string; direction: "up" | "down" | "behind_pace"; threshold_pct: number; grain: string; channel: string; campaign_id: string | null; enabled: boolean };
const METRICS = ["conversions", "meetings", "clicks", "outreach", "goal_pacing"] as const;
const DIRS: { v: Rule["direction"]; label: string }[] = [{ v: "down", label: "drops" }, { v: "up", label: "rises" }, { v: "behind_pace", label: "falls behind pace" }];
const METRIC_LABEL: Record<string, string> = { conversions: "investor intros", meetings: "meetings", clicks: "clicks", outreach: "posts published", goal_pacing: "goal pacing" };

export function AlertsPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState<Omit<Rule, "id">>({ metric: "clicks", direction: "down", threshold_pct: 20, grain: "week", channel: "both", campaign_id: null, enabled: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call<{ rules: Rule[] }>("/api/founder/social/alerts");
    setRules(r.ok ? r.data.rules ?? [] : []);
  }, []);
  useEffect(() => {
    let live = true;
    void call<{ rules: Rule[] }>("/api/founder/social/alerts").then((r) => { if (live) setRules(r.ok ? r.data.rules ?? [] : []); });
    return () => { live = false; };
  }, []);

  async function run(init: RequestInit) {
    setBusy(true); setErr(null);
    const r = await call("/api/founder/social/alerts", init);
    setBusy(false);
    if (!r.ok) setErr(r.data.error ?? "Could not save.");
    await load();
  }
  const dirLabel = (d: Rule["direction"]) => DIRS.find((x) => x.v === d)?.label ?? d;

  return (
    <div className={card}>
      <h2 className="text-base font-semibold text-slate-900">Alerts</h2>
      <p className="mt-1 text-xs text-slate-500">Get told when a number moves. Checked every hour, and each rule fires at most once per period.</p>
      <div className="mt-2 divide-y divide-slate-100">
        {rules.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
            <span className="font-medium capitalize text-slate-800">{METRIC_LABEL[r.metric] ?? r.metric}</span>
            <span className={`rounded px-2 py-0.5 ${r.direction === "up" ? "bg-emerald-50 text-emerald-700" : r.direction === "down" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{dirLabel(r.direction)}</span>
            <span className="rounded border border-slate-200 px-2 py-0.5 text-slate-600">{r.direction === "behind_pace" ? `below ${r.threshold_pct}% of pace` : `${r.threshold_pct}% or more, per ${r.grain}`}</span>
            <span className="text-slate-500">by {r.channel === "both" ? "email and in app" : r.channel === "email" ? "email" : "in app"}</span>
            <span className="ml-auto flex items-center gap-2">
              <button type="button" disabled={busy} className={`rounded px-2 py-0.5 ${r.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`} onClick={() => void run(json("PATCH", { id: r.id, enabled: !r.enabled }))}>{r.enabled ? "On" : "Off"}</button>
              <button type="button" disabled={busy} aria-label="Delete rule" className="text-slate-400 hover:text-rose-600" onClick={() => void run(json("DELETE", { id: r.id }))}>✕</button>
            </span>
          </div>
        ))}
        {rules.length === 0 && <div className="py-2 text-xs text-slate-400">No alerts yet. Add one below.</div>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <select aria-label="Metric" value={draft.metric} onChange={(e) => setDraft((p) => ({ ...p, metric: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
        </select>
        <select aria-label="Direction" value={draft.direction} onChange={(e) => setDraft((p) => ({ ...p, direction: e.target.value as Rule["direction"] }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {DIRS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
        </select>
        <span className="flex items-center gap-1">
          <input aria-label="Percent" inputMode="numeric" value={String(draft.threshold_pct)} onChange={(e) => setDraft((p) => ({ ...p, threshold_pct: Math.max(0, Number(e.target.value.replace(/[^0-9]/g, "")) || 0) }))} className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          <span className="text-xs text-slate-500">%</span>
        </span>
        <select aria-label="Period" value={draft.grain} onChange={(e) => setDraft((p) => ({ ...p, grain: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {GRAINS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select aria-label="Channel" value={draft.channel} onChange={(e) => setDraft((p) => ({ ...p, channel: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="in_app">In app</option><option value="email">Email</option><option value="both">Email and in app</option>
        </select>
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => void run(json("POST", draft))}>+ Add alert</button>
      </div>
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
    </div>
  );
}

// ───────────────────────────── Schedule board ─────────────────────────────

export type BoardPost = {
  id: string; title: string | null; body: string; status: string; scheduled_at: string | null; held_until: string | null; archived_at: string | null;
  variants: { status: string; account: { platform: string } | null }[];
};
const PLATFORM_LABEL: Record<string, string> = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", reddit: "Reddit" };
function networksOf(p: BoardPost): string {
  return [...new Set(p.variants.map((v) => v.account?.platform).filter((x): x is string => Boolean(x)))].map((x) => PLATFORM_LABEL[x] ?? x).join(", ");
}

export function ScheduleBoard({ posts, onChange }: { posts: BoardPost[]; onChange: () => Promise<void> }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveVal, setMoveVal] = useState("");

  const scheduled = useMemo(() => posts
    .filter((p) => !p.archived_at && p.status === "scheduled" && !p.held_until && p.scheduled_at)
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")), [posts]);
  const held = useMemo(() => posts.filter((p) => !p.archived_at && p.held_until), [posts]);

  // Fourteen days starting today, in Pacific time. The clock is read after mount so the first
  // render never depends on the time it happens to run.
  const [base, setBase] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setBase(Date.now()), 0); return () => clearTimeout(t); }, []);
  const days = useMemo(() => {
    if (base === null) return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < 14; i++) out.push(ptDateKey(new Date(base + i * 86_400_000)));
    return [...new Set(out)];
  }, [base]);
  const byDay = useMemo(() => {
    const m = new Map<string, BoardPost[]>();
    for (const p of scheduled) { const k = ptDateKey(new Date(p.scheduled_at as string)); m.set(k, [...(m.get(k) ?? []), p]); }
    return m;
  }, [scheduled]);
  const later = days.length === 0 ? [] : scheduled.filter((p) => !days.includes(ptDateKey(new Date(p.scheduled_at as string))));

  async function moveTo(p: BoardPost, iso: string | null) {
    if (!iso) { setMsg({ ok: false, text: "Pick a date and time (Pacific time)." }); return; }
    const r = await call("/api/founder/social/posts", json("PATCH", { postId: p.id, scheduledAt: iso }));
    if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "Could not move the post." }); return; }
    setMsg({ ok: true, text: `Moved to ${ptLabel(iso)}.` });
    setMoveId(null);
    await onChange();
  }
  async function drop(day: string) {
    const p = scheduled.find((x) => x.id === dragId);
    setDragId(null); setOverDay(null);
    if (!p || !p.scheduled_at) return;
    if (ptDateKey(new Date(p.scheduled_at)) === day) return;
    await moveTo(p, ptToIso(`${day}T${ptTimeKey(new Date(p.scheduled_at))}`));
  }

  const label = (p: BoardPost) => p.title?.trim() || p.body.split("\n")[0];
  const item = (p: BoardPost) => (
    <div key={p.id} draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => { setDragId(null); setOverDay(null); }}
      className={`cursor-grab rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs ${dragId === p.id ? "opacity-50" : ""}`}>
      <div className="truncate font-medium text-slate-900">{label(p)}</div>
      <div className="text-slate-500">{ptLabel(p.scheduled_at)}{networksOf(p) ? ` · ${networksOf(p)}` : ""}</div>
      {moveId === p.id ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <input type="datetime-local" aria-label="New date and time (PT)" value={moveVal} onChange={(e) => setMoveVal(e.target.value)} className="rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-900" />
          <button type="button" className="rounded bg-[#1A6CE4] px-2 py-1 text-xs text-white" onClick={() => void moveTo(p, ptToIso(moveVal))}>Move</button>
          <button type="button" className="text-xs text-slate-500" onClick={() => setMoveId(null)}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="mt-0.5 text-[11px] text-[#1A6CE4] hover:underline" onClick={() => { setMoveId(p.id); setMoveVal(`${ptDateKey(new Date(p.scheduled_at as string))}T${ptTimeKey(new Date(p.scheduled_at as string))}`); }}>Change time</button>
      )}
    </div>
  );

  return (
    <div className={card}>
      <h2 className="text-base font-semibold text-slate-900">Schedule</h2>
      <p className="mt-1 text-xs text-slate-500">Drag a post to another day to reschedule it. It keeps its time of day. All times are Pacific (PT).</p>
      {scheduled.length === 0 && held.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Nothing scheduled. Write a post in Compose and pick a date and time.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((day) => (
            <div key={day} onDragOver={(e) => { e.preventDefault(); setOverDay(day); }} onDragLeave={() => setOverDay((d) => (d === day ? null : d))} onDrop={(e) => { e.preventDefault(); void drop(day); }}
              className={`min-h-[72px] rounded-lg border p-2 ${overDay === day ? "border-[#1A6CE4] bg-blue-50" : "border-slate-200"}`}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
              </div>
              <div className="space-y-1.5">{(byDay.get(day) ?? []).map(item)}</div>
            </div>
          ))}
        </div>
      )}
      {later.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Later</div>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">{later.map(item)}</div>
        </div>
      )}
      {held.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved drafts waiting for your limit to reset</div>
          {held.map((p) => (
            <div key={p.id} className="mt-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-900">{label(p)}</span>
              <span className="shrink-0 text-xs text-slate-500">Reminder {ptLabel(p.held_until, false)}</span>
            </div>
          ))}
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}

// ───────────────────────────── Repeating posts ─────────────────────────────

type Series = { id: string; status: string; freq: string; interval_n: number; weekdays: number[]; time_local: string; next_run: string | null; made_count: number; body: string; brief: string | null; end_type: string; end_count: number | null };
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function seriesLabel(s: Series): string {
  const every = s.interval_n > 1 ? `every ${s.interval_n} ${s.freq === "daily" ? "days" : s.freq === "weekly" ? "weeks" : "months"}` : s.freq;
  const on = s.freq === "weekly" && s.weekdays.length ? ` on ${s.weekdays.map((d) => DAY[d]).join(", ")}` : "";
  return `Repeats ${every}${on} at ${s.time_local} PT`;
}

export function SeriesList() {
  const [series, setSeries] = useState<Series[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call<{ series: Series[] }>("/api/founder/social/recurrences");
    setSeries(r.ok ? r.data.series ?? [] : []);
  }, []);
  useEffect(() => {
    let live = true;
    void call<{ series: Series[] }>("/api/founder/social/recurrences").then((r) => { if (live) setSeries(r.ok ? r.data.series ?? [] : []); });
    return () => { live = false; };
  }, []);

  async function setStatus(id: string, status: "active" | "paused" | "ended") {
    setBusy(true); setErr(null);
    const r = await call("/api/founder/social/recurrences", json("PATCH", { id, status }));
    setBusy(false);
    if (!r.ok) setErr(r.data.error ?? "Could not update.");
    await load();
  }
  if (series.length === 0) return null;
  return (
    <div className={`${card} mt-4`}>
      <h2 className="text-base font-semibold text-slate-900">Repeating posts</h2>
      <p className="mt-1 text-xs text-slate-500">New posts in a series are added as they come due. Each one counts toward your monthly limit, and any past the limit wait as drafts until it resets.</p>
      {series.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 py-2 first:border-t-0">
          <div className="mr-auto min-w-0">
            <div className="truncate text-sm text-slate-900">{s.brief?.trim() || s.body.split("\n")[0]}</div>
            <div className="text-xs text-slate-500">{seriesLabel(s)}{s.next_run ? `, next ${ptLabel(s.next_run)}` : ""}, {s.made_count} created</div>
          </div>
          <span className={`text-xs ${s.status === "active" ? "text-emerald-700" : "text-slate-500"}`}>{s.status === "active" ? "Active" : "Paused"}</span>
          <button type="button" className={btn} disabled={busy} onClick={() => void setStatus(s.id, s.status === "active" ? "paused" : "active")}>{s.status === "active" ? "Pause" : "Resume"}</button>
          <button type="button" className="text-xs text-red-600 hover:text-red-800" disabled={busy} onClick={() => void setStatus(s.id, "ended")}>End series</button>
        </div>
      ))}
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
    </div>
  );
}
