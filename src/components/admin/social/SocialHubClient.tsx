"use client";

import { useState } from "react";
import { ARCHETYPES, type Archetype } from "@/lib/social/composer";
import type { SocialAccount, QueueItem, SocialSettings, SocialSlot } from "@/lib/social/queries";
import type { WeekBar } from "@/lib/social/attribution";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_STYLE: Record<string, string> = {
  queued: "bg-amber-50 text-amber-700", publishing: "bg-blue-50 text-blue-700", published: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700", skipped: "bg-slate-100 text-slate-500", live: "bg-emerald-50 text-emerald-700",
  connected: "bg-emerald-50 text-emerald-700", expiring: "bg-amber-50 text-amber-700", expired: "bg-rose-50 text-rose-700",
};
const chip = "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors";
const card = "rounded-xl border border-slate-200 bg-white";

type Tab = "composer" | "queue" | "rules" | "accounts" | "attribution";

export function SocialHubClient({ accounts, queue, settings: settings0, slots: slots0, linkedInReady, facebookReady, attribution }: {
  accounts: SocialAccount[]; queue: QueueItem[]; settings: SocialSettings; slots: SocialSlot[]; linkedInReady: boolean; facebookReady: boolean; attribution: WeekBar[];
}) {
  const [tab, setTab] = useState<Tab>("composer");
  const failed24 = queue.filter((q) => q.status === "failed").length;

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-slate-100">
        {(["composer", "queue", "rules", "accounts", "attribution"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium capitalize ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "accounts" ? "Accounts & API" : t}{t === "queue" && queue.length ? ` · ${queue.length}` : ""}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "composer" ? <Composer accounts={accounts} /> : null}
        {tab === "queue" ? <Queue queue={queue} /> : null}
        {tab === "rules" ? <Rules settings0={settings0} slots0={slots0} /> : null}
        {tab === "accounts" ? <Accounts accounts={accounts} linkedInReady={linkedInReady} facebookReady={facebookReady} failed24={failed24} /> : null}
        {tab === "attribution" ? <Attribution data={attribution} /> : null}
      </div>
    </div>
  );
}

function Composer({ accounts }: { accounts: SocialAccount[] }) {
  const [brief, setBrief] = useState("");
  const [archetype, setArchetype] = useState<Archetype>("proof_case");
  const [selected, setSelected] = useState<string[]>([]);
  const [variants, setVariants] = useState<{ accountId: string; body: string }[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.display_name ?? "Account";

  async function draft() {
    if (brief.trim().length < 10 || selected.length === 0) { setMsg("Add a brief and pick at least one account."); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/social/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief, archetype, accounts: selected.map((id) => ({ id, displayName: nameOf(id) })) }) });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error ?? "Draft failed."); return; }
      setVariants(j.variants ?? []);
    } finally { setBusy(false); }
  }

  async function save(approve: boolean) {
    if (variants.length === 0) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/social/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief, archetype, linkUrl: linkUrl || null, comment: comment || null, approve, variants }) });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error ?? "Save failed."); return; }
      setMsg(approve ? `Queued ${j.queued} variant(s).` : "Saved as draft.");
      setVariants([]); setBrief("");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl">
      <label className="text-[13px] font-medium text-slate-700">What happened</label>
      <p className="text-[11.5px] text-slate-400">Raw notes, not a topic — a specific moment produces a specific post.</p>
      <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} placeholder="A founder told me she'd pitched 11 investors, 9 were the wrong fit entirely…" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />

      <p className="mt-4 text-[13px] font-medium text-slate-700">Archetype</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {ARCHETYPES.map((a) => (
          <button key={a.key} onClick={() => setArchetype(a.key)} className={`${chip} ${archetype === a.key ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>{a.label}</button>
        ))}
      </div>

      <p className="mt-4 text-[13px] font-medium text-slate-700">Post as</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {accounts.length === 0 ? <span className="text-[12px] text-slate-400">No accounts connected.</span> : accounts.map((a) => {
          const on = selected.includes(a.id);
          return <button key={a.id} onClick={() => setSelected((p) => on ? p.filter((x) => x !== a.id) : [...p, a.id])} className={`${chip} ${on ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>{a.display_name ?? a.platform}</button>;
        })}
      </div>

      <button onClick={draft} disabled={busy} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Drafting…" : "Draft it"}</button>

      {variants.length > 0 ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-[11.5px] text-slate-400">Draft · matched to your voice · rewritten per account</p>
          {variants.map((v, i) => (
            <div key={v.accountId} className={`${card} p-3`}>
              <p className="mb-1.5 text-[12px] font-medium text-slate-600">{nameOf(v.accountId)}</p>
              <textarea value={v.body} onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} rows={5} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Tagged link (first comment)" className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none" />
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="First-comment text" className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => save(false)} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-50">Save draft</button>
            <button onClick={() => save(true)} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve &amp; queue</button>
          </div>
        </div>
      ) : null}
      {msg ? <p className="mt-3 text-[12px] text-slate-500">{msg}</p> : null}
    </div>
  );
}

function Queue({ queue }: { queue: QueueItem[] }) {
  if (queue.length === 0) return <p className={`${card} px-4 py-8 text-center text-[13px] text-slate-400`}>Nothing queued. Approved posts appear here per account, then publish on the next 5-minute pass.</p>;
  return (
    <ul className={`${card} divide-y divide-slate-100`}>
      {queue.map((q) => (
        <li key={q.id} className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800">{q.body}</span>
            <span className="flex items-center gap-2 text-[11px] text-slate-400">
              {q.status === "failed" && q.attempts ? `retry ${q.attempts}/3` : null}
              <span className={`rounded-full px-2.5 py-0.5 font-medium ${STATUS_STYLE[q.status] ?? "bg-slate-100 text-slate-600"}`}>{q.status}</span>
            </span>
          </div>
          {q.error ? <p className="mt-1 text-[11px] text-rose-600">{q.error}</p> : null}
          {q.url ? <a href={q.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11px] text-blue-600">View post</a> : null}
        </li>
      ))}
    </ul>
  );
}

function Rules({ settings0, slots0 }: { settings0: SocialSettings; slots0: SocialSlot[] }) {
  const [settings, setSettings] = useState(settings0);
  const [slots, setSlots] = useState(slots0);
  const [wd, setWd] = useState(2);
  const [time, setTime] = useState("08:15");

  async function patch(body: object) {
    const res = await fetch("/api/admin/social/rules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { const j = await res.json(); setSettings(j.settings); setSlots(j.slots); }
  }
  const toggle = (key: keyof SocialSettings) => patch({ settings: { [key]: !settings[key] } });

  const TOGGLES: [keyof SocialSettings, string][] = [
    ["approve_before_publish", "Approve before publishing"],
    ["rewrite_per_account", "Rewrite per account"],
    ["skip_empty_slot", "Skip slot if queue is empty"],
    ["auto_publish", "Auto-publish without review"],
  ];

  return (
    <div className="max-w-xl">
      <p className="text-[13px] font-medium text-slate-700">Weekly slots</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {slots.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[13px] text-slate-700">
            {WD[s.weekday]} {s.time_local}
            <button onClick={() => patch({ removeSlotId: s.id })} className="text-slate-400 hover:text-rose-600"><i className="ti ti-x" aria-hidden="true" /></button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1">
          <select value={wd} onChange={(e) => setWd(Number(e.target.value))} className="bg-transparent text-[13px]">{WD.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-transparent text-[13px]" />
          <button onClick={() => patch({ addSlot: { weekday: wd, time_local: time } })} className="text-indigo-600"><i className="ti ti-plus" aria-hidden="true" /></button>
        </span>
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">Rotation: {settings.rotation.map((r) => r.replace(/_/g, " ")).join(" → ")}. Slots pull from the approved queue in order.</p>

      <p className="mt-5 text-[13px] font-medium text-slate-700">Rules</p>
      <div className="mt-2 flex flex-col gap-2">
        {TOGGLES.map(([key, label]) => (
          <button key={key} onClick={() => toggle(key)} className={`${card} flex items-center justify-between px-3 py-2.5 text-left text-[13px] text-slate-700`}>
            <span>{label}</span>
            <span className={`relative inline-flex h-5 w-9 items-center rounded-full ${settings[key] ? "bg-emerald-600" : "bg-slate-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings[key] ? "translate-x-4" : "translate-x-1"}`} />
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">Auto-publish stays off — three posts a week is ninety seconds of review, and it prevents the one bad post that undoes a month of credibility.</p>
    </div>
  );
}

const PLATFORM_META: Record<string, { label: string; icon: string; color: string; start: string; kind: string }> = {
  linkedin: { label: "LinkedIn", icon: "ti-brand-linkedin", color: "#0A66C2", start: "/api/social/linkedin/start", kind: "personal" },
  facebook: { label: "Facebook", icon: "ti-brand-facebook", color: "#1877F2", start: "/api/social/facebook/start", kind: "Page" },
};

function Accounts({ accounts, linkedInReady, facebookReady, failed24 }: { accounts: SocialAccount[]; linkedInReady: boolean; facebookReady: boolean; failed24: number }) {
  const [now] = useState(() => Date.now());
  const days = (iso: string | null) => iso ? Math.max(0, Math.round((new Date(iso).getTime() - now) / 86400000)) : null;
  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-700">Accounts</p>
        <div className="flex flex-wrap justify-end gap-2">
          {linkedInReady ? (
            <a href="/api/social/linkedin/start" className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A66C2] px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"><i className="ti ti-brand-linkedin" aria-hidden="true" /> Connect LinkedIn</a>
          ) : (
            <button type="button" disabled className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 opacity-50" title="Add LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET to enable"><i className="ti ti-brand-linkedin" aria-hidden="true" /> Connect LinkedIn</button>
          )}
          {facebookReady ? (
            <a href="/api/social/facebook/start" className="inline-flex items-center gap-1.5 rounded-lg bg-[#1877F2] px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"><i className="ti ti-brand-facebook" aria-hidden="true" /> Connect Facebook</a>
          ) : (
            <button type="button" disabled className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-600 opacity-50" title="Add META_APP_ID / META_APP_SECRET to enable"><i className="ti ti-brand-facebook" aria-hidden="true" /> Connect Facebook</button>
          )}
        </div>
      </div>
      <div className={`${card} mt-2 divide-y divide-slate-100`}>
        {accounts.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-slate-400">No accounts connected yet.</p> : accounts.map((a) => {
          const d = days(a.token_expires_at);
          const meta = PLATFORM_META[a.platform];
          return (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 text-[13px]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: meta?.color ?? "#64748b" }}><i className={`ti ${meta?.icon ?? "ti-world"}`} aria-hidden="true" /></div>
                <div>
                  <p className="font-medium text-slate-900">{a.display_name ?? meta?.label ?? a.platform}</p>
                  <p className="text-[11px] text-slate-400">{a.platform} · {meta?.kind ?? "account"}{d != null ? ` · token ${d}d` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(a.status === "expiring" || a.status === "expired") && meta ? <a href={meta.start} className="text-[11px] text-indigo-600 hover:underline">Reconnect</a> : null}
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[a.status] ?? "bg-slate-100 text-slate-600"}`}>{a.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[13px] font-medium text-slate-700">API health</p>
      <div className={`${card} mt-2 divide-y divide-slate-100 text-[13px]`}>
        <Row label="LinkedIn Posts API" value={linkedInReady ? "ok" : "not connected"} ok={linkedInReady} />
        <Row label="Facebook Graph API" value={facebookReady ? "ok · v21.0" : "not connected"} ok={facebookReady} />
        <Row label="Failed last 24h" value={String(failed24)} ok={failed24 === 0} />
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">LinkedIn posts as a personal profile; Facebook posts to a Page feed with the tagged link as a comment. Page posting needs Meta App Review to go live — dev mode works on Pages you admin. Instagram is off for now.</p>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-slate-600">{label}</span>
      <span className={ok === undefined ? "font-mono text-slate-500" : ok ? "text-emerald-600" : "text-rose-600"}>{value}</span>
    </div>
  );
}

function Attribution({ data }: { data: WeekBar[] }) {
  const max = Math.max(1, ...data.map((d) => d.linkedin + d.email + d.website + d.other));
  const legend: [string, string][] = [["LinkedIn", "#4338CA"], ["Email", "#0D9488"], ["Website", "#F59E0B"], ["Other", "#CBD5E1"]];
  return (
    <div className="max-w-2xl">
      <p className="text-[13px] font-medium text-slate-700">Leads captured by source · 8 weeks</p>
      <div className="mt-4 flex items-end gap-2" style={{ height: 180 }}>
        {data.map((d) => (
          <div key={d.week} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-col-reverse overflow-hidden rounded" style={{ height: 150 }}>
              <div style={{ height: `${(d.linkedin / max) * 150}px`, background: "#4338CA" }} />
              <div style={{ height: `${(d.email / max) * 150}px`, background: "#0D9488" }} />
              <div style={{ height: `${(d.website / max) * 150}px`, background: "#F59E0B" }} />
              <div style={{ height: `${(d.other / max) * 150}px`, background: "#CBD5E1" }} />
            </div>
            <span className="text-[10px] text-slate-400">{d.week}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4">
        {legend.map(([label, color]) => <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{label}</span>)}
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">Sourced from funnel leads by attribution tag (li-/em-/web-). Posts rank by in-range founders, never impressions.</p>
    </div>
  );
}
