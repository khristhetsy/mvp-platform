"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { ARCHETYPES, type Archetype } from "@/lib/social/composer";
import { DEPARTMENTS } from "@/lib/marketing/department-grouping";
import { POST_LIBRARY, fitLink } from "@/lib/social/post-library";
import type { SocialAccount, QueueItem, SocialSettings, SocialSlot } from "@/lib/social/queries";
import type { WeekBar } from "@/lib/social/attribution";
import { Overview } from "./Overview";
import { CampaignsGoals } from "./CampaignsGoals";
import { Library } from "./Library";
import { AlertRules } from "./AlertRules";
import { AttributionPeriods } from "./AttributionPeriods";
import { AiCmo } from "./AiCmo";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATUS_STYLE: Record<string, string> = {
  connected: "bg-emerald-50 text-emerald-700", expiring: "bg-amber-50 text-amber-700", expired: "bg-rose-50 text-rose-700",
};
const chip = "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors";
const card = "rounded-xl border border-slate-200 bg-white";

/** One-line meaning per archetype (mirrors the composer's ARCHETYPE_GUIDE), shown on hover. */
const ARCHETYPE_DESC: Record<string, string> = {
  proof_case: "A concrete result or moment that proves a point. Open with the specific, show what happened, end on the lesson.",
  teardown: "Dissect what went wrong or right in a real situation — the mistakes, the fix, what to copy or avoid.",
  named_ask: "State a clear, specific ask — who you want to hear from and why. Direct, not needy.",
};

/** Numbered section header for the Compose steps. */
function StepHead({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-indigo-600 text-[10.5px] font-semibold text-white">{n}</span>
      <span className="text-[12.5px] font-semibold text-slate-800">{title}</span>
      {hint ? <span className="text-[11px] text-slate-400">— {hint}</span> : null}
    </div>
  );
}

type Tab = "overview" | "goals" | "composer" | "schedule" | "library" | "attribution" | "settings";
const TAB_ORDER: Tab[] = ["overview", "goals", "composer", "schedule", "library", "attribution", "settings"];
const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview", goals: "Campaigns & Goals", composer: "Compose", schedule: "Schedule",
  library: "Library", attribution: "Attribution", settings: "Settings",
};

/** Display label + colors per variant status (parked/scheduled/published…). */
function statusMeta(status: string): { label: string; cls: string; dot: string } {
  switch (status) {
    case "published": return { label: "Published", cls: "bg-blue-50 text-blue-700", dot: "#2563EB" };
    case "publishing": return { label: "Publishing", cls: "bg-blue-50 text-blue-700", dot: "#2563EB" };
    case "queued": return { label: "Scheduled", cls: "bg-emerald-50 text-emerald-700", dot: "#16A34A" };
    case "failed": return { label: "Failed", cls: "bg-rose-50 text-rose-700", dot: "#E11D48" };
    case "parked": return { label: "Parked", cls: "bg-amber-50 text-amber-700", dot: "#CA8A04" };
    default: return { label: "Draft", cls: "bg-slate-100 text-slate-500", dot: "#64748B" };
  }
}

export function SocialHubClient({ accounts, queue, settings: settings0, slots: slots0, linkedInReady, facebookReady, googleReady, attribution }: {
  accounts: SocialAccount[]; queue: QueueItem[]; settings: SocialSettings; slots: SocialSlot[]; linkedInReady: boolean; facebookReady: boolean; googleReady: boolean; attribution: WeekBar[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const failed24 = queue.filter((q) => q.status === "failed").length;
  const topPostBody = queue.find((q) => q.status === "published" && q.body)?.body ?? null;

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-slate-100">
        {TAB_ORDER.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {TAB_LABELS[t]}{t === "schedule" && queue.length ? ` · ${queue.length}` : ""}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "overview" ? <Overview failedCount={failed24} topPostBody={topPostBody} onNavigate={(t) => setTab(t as Tab)} /> : null}
        {tab === "goals" ? <CampaignsGoals /> : null}
        {tab === "composer" ? <Composer accounts={accounts} googleReady={googleReady} /> : null}
        {tab === "schedule" ? <Schedule queue={queue} accounts={accounts} slots={slots0} googleReady={googleReady} onAddPost={() => setTab("composer")} /> : null}
        {tab === "library" ? <Library /> : null}
        {tab === "attribution" ? (
          <div className="space-y-5">
            <AttributionPeriods />
            <div>
              <div className="mb-2 text-[12.5px] font-semibold text-slate-800">Signups by channel</div>
              <Attribution data={attribution} />
            </div>
          </div>
        ) : null}
        {tab === "settings" ? (
          <div className="space-y-6">
            <AlertRules />
            <Rules settings0={settings0} slots0={slots0} />
            <Accounts accounts={accounts} linkedInReady={linkedInReady} facebookReady={facebookReady} failed24={failed24} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Composer({ accounts, googleReady }: { accounts: SocialAccount[]; googleReady: boolean }) {
  const [brief, setBrief] = useState("");
  const [archetype, setArchetype] = useState<Archetype>("proof_case");
  const [department, setDepartment] = useState<string>("Marketing");
  const [campaignId, setCampaignId] = useState<string>("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [newCampaign, setNewCampaign] = useState<{ open: boolean; name: string; budget: string }>({ open: false, name: "", budget: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [variants, setVariants] = useState<{ accountId: string; body: string }[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [comment, setComment] = useState("");
  const [schedOn, setSchedOn] = useState(true);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("08:15");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  // Recurrence
  const [repeat, setRepeat] = useState(false);
  const [recFreq, setRecFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [recInterval, setRecInterval] = useState("1");
  const [recWeekdays, setRecWeekdays] = useState<number[]>([]);
  const [recEndType, setRecEndType] = useState<"never" | "on_date" | "after">("never");
  const [recEndDate, setRecEndDate] = useState("");
  const [recEndCount, setRecEndCount] = useState("12");
  const [recPreview, setRecPreview] = useState<{ upcoming: number[]; total: number } | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/admin/social/campaigns").then((r) => (r.ok ? r.json() : { campaigns: [] })).then((d) => setCampaigns((d.campaigns ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))).catch(() => {}); }, []);

  async function saveNewCampaign() {
    const name = newCampaign.name.trim();
    if (!name) return;
    const budgetCents = Math.round((parseFloat(newCampaign.budget) || 0) * 100);
    const r = await fetch("/api/admin/social/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, budgetCents }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.campaign) { setCampaigns((p) => [{ id: j.campaign.id, name: j.campaign.name }, ...p]); setCampaignId(j.campaign.id); setNewCampaign({ open: false, name: "", budget: "" }); }
  }

  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.display_name ?? "Account";
  const platformOf = (id: string) => accounts.find((a) => a.id === id)?.platform ?? "linkedin";

  const CTAS = [
    { key: "fit", label: "Take the fit quiz", text: "See the investors that match your raise →", url: "https://icapos.com/fit" },
    { key: "call", label: "Book a call", text: "Book a structuring call →", url: "https://icapos.com/schedule/dc2f3667-ca80-4f35-a1cd-ba0c3adac510" },
    { key: "learn", label: "Learn more", text: "Learn more →", url: "https://icapos.com" },
  ];

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

  function loadLibraryPost(p: (typeof POST_LIBRARY)[number]) {
    if (selected.length === 0) { setMsg("Pick at least one account, then load a post."); return; }
    setArchetype(p.archetype);
    setBrief(p.title);
    setVariants(selected.map((id) => ({ accountId: id, body: p.body })));
    setComment(p.cta);
    setLinkUrl(fitLink(p.tag));
    setLibOpen(false);
    setMsg(null);
  }

  const scheduledISO = () => (schedOn && schedDate ? new Date(`${schedDate}T${schedTime || "08:15"}`).toISOString() : null);

  // Recurrence rule assembled from the schedule inputs.
  function recRule() {
    return {
      freq: recFreq,
      interval: Math.max(1, parseInt(recInterval, 10) || 1),
      weekdays: recFreq === "weekly" ? (recWeekdays.length ? recWeekdays : (schedDate ? [new Date(`${schedDate}T00:00`).getDay()] : [])) : [],
      timeLocal: schedTime || "08:15",
      startDate: schedDate,
      endType: recEndType,
      endDate: recEndType === "on_date" ? (recEndDate || null) : null,
      endCount: recEndType === "after" ? (Math.max(1, parseInt(recEndCount, 10) || 1)) : null,
    };
  }
  async function previewRec() {
    if (!schedDate) { setRecPreview(null); return; }
    try {
      const res = await fetch("/api/admin/social/recurrences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...recRule(), dryRun: true }) });
      const d = await res.json();
      setRecPreview({ upcoming: d.upcoming ?? [], total: d.total ?? 0 });
    } catch { setRecPreview(null); }
  }
  async function saveRecurring() {
    if (variants.length === 0) { setMsg("Draft the post first."); return; }
    if (!schedDate) { setMsg("Pick a start date."); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/social/recurrences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...recRule(), campaignId: campaignId || null, archetype, department, brief: brief || null, body: variants[0]?.body ?? "", comment: comment || null, linkUrl: linkUrl || null, variants }) });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error ?? "Could not schedule the series."); return; }
      setMsg(`Recurring series scheduled — ${recPreview?.total ?? "the"} occurrences will appear on the Schedule tab.`);
      setVariants([]); setBrief(""); setRepeat(false); setRecPreview(null);
    } finally { setBusy(false); }
  }
  const WEEKDAYS: { l: string; d: number }[] = [{ l: "S", d: 0 }, { l: "M", d: 1 }, { l: "T", d: 2 }, { l: "W", d: 3 }, { l: "T", d: 4 }, { l: "F", d: 5 }, { l: "S", d: 6 }];

  async function save(mode: "draft" | "park" | "schedule") {
    if (variants.length === 0) return;
    const scheduledAt = mode === "schedule" ? scheduledISO() : null;
    if (mode === "schedule" && !scheduledAt) { setMsg("Pick a date and time to schedule."); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/social/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief, archetype, department, campaignId: campaignId || null, linkUrl: linkUrl || null, comment: comment || null, approve: mode !== "draft", scheduledAt, variants }) });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error ?? "Save failed."); return; }
      setMsg(mode === "schedule" ? `Scheduled ${j.queued} post(s) — check the Schedule tab.` : mode === "park" ? `Parked ${j.parked} post(s) in the queue.` : "Saved as draft.");
      setVariants([]); setBrief("");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl">
      {/* Heading */}
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-[16px] font-semibold text-slate-900">Compose a post</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">Draft once, publish to every connected account. AI writes a per-account variant from your notes — you review before anything goes out.</p>
      </div>

      {/* 1 · What to post */}
      <div className="mt-4">
        <StepHead n={1} title="What to post" hint="your raw notes + the angle" />
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} placeholder="A founder told me she'd pitched 11 investors, 9 were the wrong fit entirely…" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
        <p className="mt-1 text-[11px] text-slate-400">Raw notes, not a topic — a specific moment produces a specific post.</p>
        <p className="mt-3 text-[11px] text-slate-500">Angle <span className="text-slate-400">(hover for what each means)</span></p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {ARCHETYPES.map((a) => (
            <span key={a.key} className="group relative">
              <button onClick={() => setArchetype(a.key)} className={`${chip} inline-flex items-center gap-1.5 ${archetype === a.key ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>
                {a.label}<span className="text-[10px] opacity-50">ⓘ</span>
              </button>
              <span role="tooltip" className="pointer-events-none invisible absolute left-0 top-[calc(100%+8px)] z-10 w-56 rounded-lg bg-slate-900 px-2.5 py-2 text-[11px] leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {ARCHETYPE_DESC[a.key] ?? ""}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* 2 · Where it belongs */}
      <div className="mt-5">
        <StepHead n={2} title="Where it belongs" hint="for goals & attribution" />
      <div className="mt-2 flex flex-wrap gap-6">
        <div>
          <p className="text-[12px] font-medium text-slate-700">Department</p>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px]">
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[13px] font-medium text-slate-700">Campaign</p>
          <div className="mt-1.5 flex items-center gap-2">
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px]">
              <option value="">None</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => setNewCampaign((p) => ({ ...p, open: !p.open }))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50">＋ New</button>
          </div>
          {newCampaign.open ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <input value={newCampaign.name} onChange={(e) => setNewCampaign((p) => ({ ...p, name: e.target.value }))} placeholder="Campaign name" className="rounded-md border border-slate-200 px-2 py-1 text-[12px]" />
              <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span className="text-[12px] text-slate-400">$</span>
                <input value={newCampaign.budget} onChange={(e) => setNewCampaign((p) => ({ ...p, budget: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder="Budget" className="w-20 text-[12px] outline-none" />
              </div>
              <button type="button" onClick={() => void saveNewCampaign()} disabled={!newCampaign.name.trim()} className="rounded-md bg-indigo-600 px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50">Create</button>
            </div>
          ) : null}
        </div>
      </div>

      </div>

      {/* 3 · Accounts & author */}
      <div className="mt-5">
        <StepHead n={3} title="Accounts & author" hint="who this publishes to" />
        <div className="mt-2 flex flex-wrap gap-2">
          {accounts.length === 0 ? <span className="text-[12px] text-slate-400">No accounts connected.</span> : accounts.map((a) => {
            const on = selected.includes(a.id);
            return <button key={a.id} onClick={() => setSelected((p) => on ? p.filter((x) => x !== a.id) : [...p, a.id])} className={`${chip} ${on ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>{a.display_name ?? a.platform}</button>;
          })}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={draft} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Drafting…" : "Draft it"}</button>
          <button type="button" onClick={() => setLibOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600"><i className="ti ti-books" aria-hidden="true" /> Post library ({POST_LIBRARY.length})</button>
        </div>
      </div>

      {libOpen ? (
        <div className={`${card} mt-3 divide-y divide-slate-100`}>
          <div className="flex items-center justify-between px-4 py-2 text-[11px] text-slate-400">
            <span>Capital funnel · load a post into the composer</span><span>Order: 1 · 5 · 8 · 3 · 7</span>
          </div>
          {POST_LIBRARY.map((p) => (
            <div key={p.n} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-slate-800">{p.n} · {p.title} <span className="font-mono text-[10px] text-slate-400">{p.tag}</span></p>
                <p className="truncate text-[11px] text-slate-400">{p.body.split("\n")[0]}</p>
              </div>
              <button type="button" onClick={() => loadLibraryPost(p)} className="flex-shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-[11.5px] font-medium text-white">Use</button>
            </div>
          ))}
        </div>
      ) : null}

      {variants.length > 0 ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-[11.5px] text-slate-400">Draft · matched to your voice · rewritten per account</p>
          {variants.map((v, i) => (
            <div key={v.accountId} className={`${card} p-3`}>
              <p className="mb-1.5 text-[12px] font-medium text-slate-600">{nameOf(v.accountId)}</p>
              <textarea value={v.body} onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} rows={5} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none" />
            </div>
          ))}
          <div>
            <StepHead n={4} title="Link & call-to-action" hint="posts as the first comment" />
            <div className="mt-2 flex flex-wrap gap-2">
              {CTAS.map((c) => (
                <button key={c.key} type="button" onClick={() => { setComment(c.text); setLinkUrl(c.url); }} className={`${chip} ${comment === c.text ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>{c.label}</button>
              ))}
              <button type="button" onClick={() => { setComment(""); setLinkUrl(""); }} className={`${chip} border-slate-200 text-slate-600`}>Custom</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="CTA text (first comment)" className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none" />
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="CTA link (https://…)" className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none" />
          </div>

          {/* schedule row */}
          <div>
          <StepHead n={5} title="When to publish" />
          <div className={`${card} mt-2 p-3`}>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setSchedOn((v) => !v)} className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-700">
                <span className={`relative inline-flex h-5 w-9 items-center rounded-full ${schedOn ? "bg-emerald-600" : "bg-slate-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${schedOn ? "translate-x-4" : "translate-x-1"}`} />
                </span>
                Schedule
              </button>
              <input type="date" value={schedDate} disabled={!schedOn} onChange={(e) => setSchedDate(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] disabled:opacity-40" />
              <input type="time" value={schedTime} disabled={!schedOn} onChange={(e) => setSchedTime(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] disabled:opacity-40" />
              {googleReady ? <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><i className="ti ti-brand-google" aria-hidden="true" /> mirrors to Google Calendar</span> : null}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Toggle off to park the post in the queue without a date — you can schedule it later from the Schedule tab.</p>

            {schedOn && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => { setRepeat((v) => !v); setRecPreview(null); }} className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-700">
                  <span className={`relative inline-flex h-5 w-9 items-center rounded-full ${repeat ? "bg-indigo-600" : "bg-slate-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${repeat ? "translate-x-4" : "translate-x-1"}`} />
                  </span>
                  <i className="ti ti-repeat" aria-hidden="true" /> Repeat
                </button>
                {repeat && (
                  <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-500">Every</span>
                      <input value={recInterval} onChange={(e) => { setRecInterval(e.target.value.replace(/[^0-9]/g, "")); setRecPreview(null); }} className="w-12 rounded-md border border-slate-200 px-2 py-1 text-[12px]" />
                      <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-[11px]">
                        {(["daily", "weekly", "monthly"] as const).map((f) => (
                          <button key={f} type="button" onClick={() => { setRecFreq(f); setRecPreview(null); }} className={`px-2.5 py-1 capitalize ${recFreq === f ? "bg-indigo-600 text-white" : "border-l border-slate-200 text-slate-600 first:border-l-0"}`}>{f === "daily" ? "Day" : f === "weekly" ? "Week" : "Month"}</button>
                        ))}
                      </div>
                    </div>
                    {recFreq === "weekly" && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="mr-1 text-[10.5px] text-slate-400">On</span>
                        {WEEKDAYS.map((w, i) => {
                          const on = recWeekdays.includes(w.d);
                          return <button key={i} type="button" onClick={() => { setRecWeekdays((p) => on ? p.filter((x) => x !== w.d) : [...p, w.d]); setRecPreview(null); }} className={`h-6 w-6 rounded-full text-[10.5px] ${on ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600"}`}>{w.l}</button>;
                        })}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-500">Ends</span>
                      {([["never", "Never"], ["on_date", "On date"], ["after", "After N"]] as const).map(([v, lbl]) => (
                        <button key={v} type="button" onClick={() => { setRecEndType(v); setRecPreview(null); }} className={`rounded-full px-2.5 py-1 text-[11px] ${recEndType === v ? "border-[1.5px] border-indigo-400 text-indigo-700" : "border border-slate-200 text-slate-600"}`}>{lbl}</button>
                      ))}
                      {recEndType === "on_date" && <input type="date" value={recEndDate} onChange={(e) => { setRecEndDate(e.target.value); setRecPreview(null); }} className="rounded-md border border-slate-200 px-2 py-1 text-[12px]" />}
                      {recEndType === "after" && <span className="flex items-center gap-1 text-[11px] text-slate-500"><input value={recEndCount} onChange={(e) => { setRecEndCount(e.target.value.replace(/[^0-9]/g, "")); setRecPreview(null); }} className="w-12 rounded-md border border-slate-200 px-2 py-1 text-[12px]" /> posts</span>}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button type="button" onClick={() => void previewRec()} disabled={!schedDate} className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] text-indigo-600 disabled:opacity-40">Preview dates</button>
                      {recPreview && (
                        <span className="text-[11px] text-slate-500">
                          {recPreview.upcoming.length ? recPreview.upcoming.slice(0, 4).map((ms) => new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" })).join(" · ") : "No dates"}
                          {recPreview.total ? ` … ${recPreview.total} total` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowPreview(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"><i className="ti ti-eye" aria-hidden="true" /> Preview</button>
            <button onClick={() => save("draft")} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-50">Save draft</button>
            <button onClick={() => save("park")} disabled={busy} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 disabled:opacity-50">Park in Queue</button>
            {repeat
              ? <button onClick={() => void saveRecurring()} disabled={busy || !schedDate} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><i className="ti ti-repeat" aria-hidden="true" /> Schedule recurring post</button>
              : <button onClick={() => save("schedule")} disabled={busy || !schedOn || !schedDate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Schedule post</button>}
          </div>
        </div>
      ) : null}
      {msg ? <p className="mt-3 text-[12px] text-slate-500">{msg}</p> : null}

      {showPreview && variants[0] ? (
        <PreviewModal onClose={() => setShowPreview(false)} name={nameOf(variants[0].accountId)} platform={platformOf(variants[0].accountId)} body={variants[0].body} comment={comment} link={linkUrl} />
      ) : null}

      <div className="mt-4">
        <AiCmo tab="Compose" context={() => ({ archetype, department, campaign: campaigns.find((c) => c.id === campaignId)?.name ?? null, hasLink: Boolean(linkUrl) })} />
      </div>
    </div>
  );
}

/** Shared LinkedIn/Facebook-style post preview. */
function PreviewModal({ onClose, name, platform, body, comment, link }: { onClose: () => void; name: string; platform: string | null; body: string; comment: string | null; link: string | null }) {
  const fb = platform === "facebook";
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${fb ? "bg-[#1877F2]" : "bg-[#0A66C2]"}`}><i className={`ti ${fb ? "ti-brand-facebook" : "ti-brand-linkedin"}`} aria-hidden="true" /></span>
          <div><p className="text-[12.5px] font-medium text-slate-900">{name}</p><p className="text-[10.5px] text-slate-400">{fb ? "Facebook" : "LinkedIn"} · how it&rsquo;ll post</p></div>
          <button type="button" onClick={onClose} className="ml-auto text-slate-400"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        <div className="whitespace-pre-wrap px-3 pb-3 text-[13px] leading-relaxed text-slate-800">{body}</div>
        {comment || link ? (
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 text-[11.5px] text-slate-600"><i className="ti ti-message-circle" aria-hidden="true" /> First comment: {comment ? `${comment} ` : ""}<span className="text-indigo-600">{link}</span></div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Schedule surface: calendar (month/list) + unscheduled rail ────────────── */

const titleOf = (q: QueueItem) => (q.body.split("\n").find((l) => l.trim()) ?? "Post").slice(0, 60);
const itemISO = (q: QueueItem) => q.scheduled_at ?? q.published_at ?? null;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Schedule({ queue: initial, accounts, slots, googleReady, onAddPost }: { queue: QueueItem[]; accounts: SocialAccount[]; slots: SocialSlot[]; googleReady: boolean; onAddPost: () => void }) {
  const [queue, setQueue] = useState<QueueItem[]>(initial);
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [preview, setPreview] = useState<QueueItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [scheduling, setScheduling] = useState<QueueItem | null>(null);
  const [sDate, setSDate] = useState("");
  const [sTime, setSTime] = useState("08:15");
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  // Assign existing posts to a campaign — selection is keyed by post_id.
  const [selPosts, setSelPosts] = useState<Set<string>>(new Set());
  // Recurrence series summary for the selected post.
  const [recSummary, setRecSummary] = useState<{ label: string; status: string; madeCount: number } | null>(null);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [assignTo, setAssignTo] = useState<string>("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/admin/social/campaigns").then((r) => (r.ok ? r.json() : { campaigns: [] })).then((d) => setCamps((d.campaigns ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))).catch(() => {}); }, []);
  const toggleSel = (postId: string) => setSelPosts((p) => { const n = new Set(p); if (n.has(postId)) n.delete(postId); else n.add(postId); return n; });
  async function assignCampaign() {
    if (selPosts.size === 0) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/social/posts/assign-campaign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postIds: [...selPosts], campaignId: assignTo || null }) });
      if (r.ok) { setSelPosts(new Set()); setAssignTo(""); await reload(); }
    } finally { setBusy(false); }
  }

  const platformOf = (name: string | null) => accounts.find((a) => a.display_name === name)?.platform ?? "linkedin";
  const defaultTime = slots[0]?.time_local?.slice(0, 5) || "08:15";

  const rail = queue.filter((q) => !itemISO(q));
  const dated = queue.filter((q) => itemISO(q));

  const byDay = useMemo(() => {
    const m = new Map<string, QueueItem[]>();
    for (const q of dated) { const iso = itemISO(q)!; const k = ymd(new Date(iso)); (m.get(k) ?? m.set(k, []).get(k)!).push(q); }
    for (const list of m.values()) list.sort((a, b) => (itemISO(a)! < itemISO(b)! ? -1 : 1));
    return m;
  }, [dated]);

  async function reload() {
    try { const r = await fetch("/api/admin/social/queue"); if (r.ok) { const nq: QueueItem[] = (await r.json()).queue ?? []; setQueue(nq); setSelected((s) => (s ? nq.find((x) => x.id === s.id) ?? null : null)); } } catch { /* keep */ }
  }
  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/social/queue/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      if (r.ok) { setEditing(false); setScheduling(null); await reload(); } else { alert((await r.json()).error ?? "Failed."); }
    } finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm("Delete this post permanently?")) return;
    setBusy(true);
    try { await fetch(`/api/admin/social/queue/${id}`, { method: "DELETE" }); setSelected(null); await reload(); } finally { setBusy(false); }
  }
  // Per-event calendar styling: color + busy/free. Updates the variant then reloads.
  async function setStyle(id: string, patch: { color?: string | null; busy?: boolean }) {
    setBusy(true);
    try { await fetch("/api/admin/social/variants/style", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: id, ...patch }) }); await reload(); } finally { setBusy(false); }
  }
  // Load the recurrence summary whenever a series post is selected.
  useEffect(() => {
    const rid = selected?.recurrence_id;
    if (!rid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecSummary(null);
      return;
    }
    let live = true;
    fetch(`/api/admin/social/recurrences/${rid}`).then((r) => r.json()).then((d) => { if (live) setRecSummary(d.summary ?? null); }).catch(() => { if (live) setRecSummary(null); });
    return () => { live = false; };
  }, [selected?.recurrence_id]);
  async function recAct(id: string, action: "pause" | "resume" | "end") {
    if (action === "end" && !confirm("End this recurring series? Already-scheduled occurrences stay; no new ones are created.")) return;
    setBusy(true);
    try { await fetch(`/api/admin/social/recurrences/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); await reload(); const r = await fetch(`/api/admin/social/recurrences/${id}`).then((x) => x.json()).catch(() => ({})); setRecSummary(r.summary ?? null); } finally { setBusy(false); }
  }
  function openSchedule(q: QueueItem) {
    const base = q.scheduled_at ? new Date(q.scheduled_at) : null;
    setSDate(base ? ymd(base) : ""); setSTime(base ? `${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}` : defaultTime);
    setScheduling(q);
  }
  function confirmSchedule() {
    if (!scheduling || !sDate) return;
    act(scheduling.id, "schedule", { scheduledAt: new Date(`${sDate}T${sTime || defaultTime}`).toISOString() });
  }
  // Drop a dragged post onto a day: keep its existing time if it had one, else the default slot time.
  function dropOnDay(dateKey: string) {
    const id = dragId; setDragId(null); setOverKey(null);
    if (!id) return;
    const q = queue.find((x) => x.id === id);
    if (!q || q.status === "published") return;
    const base = q.scheduled_at ? new Date(q.scheduled_at) : null;
    const time = base ? `${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}` : defaultTime;
    act(id, "schedule", { scheduledAt: new Date(`${dateKey}T${time}`).toISOString() });
  }
  const dragProps = (q: QueueItem) => q.status === "published" ? {} : {
    draggable: true,
    onDragStart: (e: DragEvent) => { setDragId(q.id); e.dataTransfer.effectAllowed = "move"; },
    onDragEnd: () => { setDragId(null); setOverKey(null); },
  };
  const dropProps = (key: string) => ({
    onDragOver: (e: DragEvent) => { if (dragId) { e.preventDefault(); if (overKey !== key) setOverKey(key); } },
    onDragLeave: () => setOverKey((k) => (k === key ? null : k)),
    onDrop: (e: DragEvent) => { e.preventDefault(); dropOnDay(key); },
  });

  // month grid (Monday-first)
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const todayKey = ymd(new Date());

  // week (Monday-first, containing anchor)
  const weekStart = (() => { const d = new Date(anchor); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; })();
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const weekEnd = weekDays[6];
  const shift = (dir: number) => setAnchor((a) => { const d = new Date(a); if (view === "week") d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir); return d; });
  const label = view === "month" ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} – ${weekStart.getMonth() === weekEnd.getMonth() ? "" : MONTHS[weekEnd.getMonth()].slice(0, 3) + " "}${weekEnd.getDate()}`;

  return (
    <div>
      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {view !== "list" ? (
            <>
              <span className="text-[15px] font-semibold text-slate-800">{label}</span>
              <button type="button" onClick={() => shift(-1)} className="rounded-md border border-slate-200 px-2 py-0.5 text-slate-500 hover:bg-slate-50"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
              <button type="button" onClick={() => shift(1)} className="rounded-md border border-slate-200 px-2 py-0.5 text-slate-500 hover:bg-slate-50"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
              <button type="button" onClick={() => setAnchor(new Date())} className="rounded-md border border-slate-200 px-2.5 py-0.5 text-[12px] text-slate-500 hover:bg-slate-50">Today</button>
            </>
          ) : <span className="text-[15px] font-semibold text-slate-800">All posts</span>}
          <span className="ml-1 inline-flex overflow-hidden rounded-lg border border-slate-200 text-[12px]">
            {(["month", "week", "list"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? "bg-indigo-600 text-white" : "text-slate-500"}`}>{v}</button>
            ))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] ${googleReady ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${googleReady ? "bg-emerald-500" : "bg-slate-300"}`} />{googleReady ? "Google Calendar synced" : "Calendar not connected"}
          </span>
          <button type="button" onClick={onAddPost} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700"><i className="ti ti-plus" aria-hidden="true" /> Add post</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
        {/* unscheduled rail */}
        <div className={`${card} h-max overflow-hidden`}>
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[12px] font-semibold text-slate-700">Unscheduled · {rail.length}</p>
            <p className="text-[10.5px] text-slate-400">{view === "list" ? "Approved & drafts awaiting a date" : "Drag onto a day to schedule"}</p>
          </div>
          <div className="flex flex-col gap-2 p-2">
            {rail.length === 0 ? <p className="px-1 py-3 text-center text-[11.5px] text-slate-400">Nothing parked.</p> : rail.map((q) => {
              const sm = statusMeta(q.status);
              return (
                <div key={q.id} {...dragProps(q)} onClick={() => { setSelected(q); setEditing(false); }} className={`cursor-grab rounded-lg border px-2.5 py-2 text-left active:cursor-grabbing ${selected?.id === q.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"} ${dragId === q.id ? "opacity-40" : ""}`}>
                  <p className="truncate text-[11.5px] font-medium text-slate-800"><i className="ti ti-grip-vertical mr-0.5 text-slate-300" aria-hidden="true" />{titleOf(q)}</p>
                  <p className="mt-1 flex items-center gap-1 text-[9.5px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.dot }} />{sm.label} · {q.account_name ?? q.platform ?? "—"}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* calendar / week / list */}
        {view === "month" ? (
          <div className={`${card} overflow-hidden`}>
            <div className="grid grid-cols-7 bg-slate-50 text-center text-[10px] text-slate-400">
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: totalCells }).map((_, i) => {
                const dayNum = i - offset + 1;
                const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const dateObj = new Date(anchor.getFullYear(), anchor.getMonth(), dayNum);
                const key = ymd(dateObj);
                const items = inMonth ? (byDay.get(key) ?? []) : [];
                const over = overKey === key && dragId;
                return (
                  <div key={i} {...(inMonth ? dropProps(key) : {})} className={`min-h-[76px] border-b border-l border-slate-100 p-1 ${i % 7 === 0 ? "border-l-0" : ""} ${!inMonth ? "bg-slate-50/60" : ""} ${over ? "bg-emerald-50 ring-1 ring-inset ring-emerald-400" : ""}`}>
                    <div className={`text-[9.5px] ${key === todayKey ? "font-semibold text-indigo-600" : "text-slate-400"}`}>{inMonth ? dayNum : ""}</div>
                    {items.map((q) => {
                      const sm = statusMeta(q.status);
                      const iso = itemISO(q)!;
                      return (
                        <div key={q.id} {...dragProps(q)} onClick={() => { setSelected(q); setEditing(false); }} className={`mt-0.5 block w-full cursor-pointer rounded border-l-2 px-1 py-0.5 text-left text-[9px] leading-tight ${dragId === q.id ? "opacity-40" : ""}`} style={{ borderColor: q.event_color ?? sm.dot, background: `${q.event_color ?? sm.dot}14` }}>
                          <span className="font-medium text-slate-700">{hhmm(iso)} {q.recurrence_id ? "↻ " : ""}{titleOf(q).slice(0, 16)}</span><br />
                          <span style={{ color: q.event_color ?? sm.dot }}>{q.busy ? "●" : "○"} {sm.label}{!q.busy ? " · free" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === "week" ? (
          <div className={`${card} grid grid-cols-2 overflow-hidden sm:grid-cols-4 lg:grid-cols-7`}>
            {weekDays.map((d) => {
              const key = ymd(d); const items = byDay.get(key) ?? []; const over = overKey === key && dragId;
              return (
                <div key={key} {...dropProps(key)} className={`min-h-[160px] border-b border-l border-slate-100 first:border-l-0 ${over ? "bg-emerald-50 ring-1 ring-inset ring-emerald-400" : ""}`}>
                  <div className={`border-b border-slate-100 px-2 py-1.5 text-[10.5px] ${key === todayKey ? "font-semibold text-indigo-600" : "text-slate-500"}`}>{WD[d.getDay()]} {d.getDate()}</div>
                  <div className="flex flex-col gap-1 p-1.5">
                    {items.length === 0 ? <span className="px-1 text-[9.5px] text-slate-300">{dragId ? "drop here" : "—"}</span> : items.map((q) => {
                      const sm = statusMeta(q.status); const iso = itemISO(q)!;
                      return (
                        <div key={q.id} {...dragProps(q)} onClick={() => { setSelected(q); setEditing(false); }} className={`cursor-pointer rounded border-l-2 px-1.5 py-1 text-[10px] leading-tight ${dragId === q.id ? "opacity-40" : ""}`} style={{ borderColor: q.event_color ?? sm.dot, background: `${q.event_color ?? sm.dot}14` }}>
                          <span className="font-medium text-slate-700">{hhmm(iso)}</span> {q.recurrence_id ? "↻ " : ""}{titleOf(q).slice(0, 22)}<br />
                          <span style={{ color: q.event_color ?? sm.dot }}>{q.busy ? "●" : "○"} {sm.label}{!q.busy ? " · free" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {selPosts.size > 0 ? (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[13px] text-indigo-800">
                <b>{selPosts.size} selected</b>
                <span>Assign to campaign</span>
                <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[12.5px]">
                  <option value="">None (clear)</option>
                  {camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => void assignCampaign()} disabled={busy} className="rounded-md bg-indigo-600 px-3 py-1 text-[12.5px] font-medium text-white disabled:opacity-50">Apply</button>
                <button type="button" onClick={() => setSelPosts(new Set())} className="ml-auto text-[12px] text-indigo-500">Clear</button>
              </div>
            ) : null}
            <div className={`${card} divide-y divide-slate-100`}>
            {dated.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-slate-400">No scheduled or published posts yet.</p> : [...dated].sort((a, b) => (itemISO(a)! < itemISO(b)! ? 1 : -1)).map((q) => {
              const sm = statusMeta(q.status); const iso = itemISO(q)!;
              return (
                <div key={q.id} className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  {q.post_id ? <input type="checkbox" checked={selPosts.has(q.post_id)} onChange={() => toggleSel(q.post_id!)} className="h-3.5 w-3.5 shrink-0" aria-label="Select post" /> : <span className="w-3.5" />}
                  <button type="button" onClick={() => { setSelected(q); setEditing(false); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-800">{titleOf(q)}</span>
                    {q.campaign_name ? <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">{q.campaign_name}</span> : null}
                    <span className="shrink-0 text-[11.5px] text-slate-500">{new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" })} · {hhmm(iso)}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${sm.cls}`}>● {sm.label}</span>
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* selected detail */}
      {selected ? (() => {
        const q = selected; const sm = statusMeta(q.status); const iso = itemISO(q); const live = q.status === "published"; const onCal = Boolean(iso);
        return (
          <div className={`${card} mt-4 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-800">{titleOf(q)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sm.cls}`}>● {sm.label}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-slate-500">{q.account_name ?? q.platform ?? "—"}{iso ? ` · ${new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : " · no date"}</p>
                {q.error ? <p className="mt-1 text-[11px] text-rose-600">{q.error}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] text-slate-400">Event color</span>
                  {["#534AB7", "#185FA5", "#0F6E56", "#CA8A04", "#A32D2D"].map((c) => (
                    <button key={c} type="button" aria-label={`Set color ${c}`} onClick={() => void setStyle(q.id, { color: c })}
                      className="h-4 w-4 rounded-full ring-offset-1" style={{ background: c, boxShadow: q.event_color === c ? `0 0 0 2px #fff, 0 0 0 3px ${c}` : "none" }} />
                  ))}
                  <button type="button" onClick={() => void setStyle(q.id, { color: null })} className="text-[10px] text-slate-400 hover:text-slate-600">by campaign</button>
                  <span className="ml-2 text-[10.5px] text-slate-400">·</span>
                  <button type="button" onClick={() => void setStyle(q.id, { busy: true })} className={`rounded px-2 py-0.5 text-[10px] ${q.busy ? "bg-rose-50 text-rose-700" : "text-slate-500"}`}>● Busy</button>
                  <button type="button" onClick={() => void setStyle(q.id, { busy: false })} className={`rounded px-2 py-0.5 text-[10px] ${!q.busy ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}>○ Free</button>
                </div>
                {q.recurrence_id && recSummary ? (
                  <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/50 px-2.5 py-2">
                    <div className="text-[11.5px] text-indigo-700"><i className="ti ti-repeat" aria-hidden="true" /> <b className="font-semibold">{recSummary.label}</b> {recSummary.status !== "active" ? <span className="text-slate-500">· {recSummary.status}</span> : null}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {recSummary.status === "active"
                        ? <button type="button" disabled={busy} onClick={() => void recAct(q.recurrence_id!, "pause")} className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10.5px] text-amber-700">Pause series</button>
                        : recSummary.status === "paused"
                          ? <button type="button" disabled={busy} onClick={() => void recAct(q.recurrence_id!, "resume")} className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10.5px] text-emerald-700">Resume series</button>
                          : null}
                      {recSummary.status !== "ended" && <button type="button" disabled={busy} onClick={() => void recAct(q.recurrence_id!, "end")} className="rounded-md border border-rose-200 px-2.5 py-1 text-[10.5px] text-rose-600">End series</button>}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <DetailBtn icon="ti-eye" label="Preview" onClick={() => setPreview(q)} accent />
                {!live ? <DetailBtn icon="ti-edit" label="Edit" onClick={() => { setEditing(true); setDraft(q.body); }} /> : null}
                {onCal && !live ? <DetailBtn icon="ti-calendar" label="Reschedule" onClick={() => openSchedule(q)} /> : null}
                {!onCal ? <DetailBtn icon="ti-calendar-plus" label="Schedule" onClick={() => openSchedule(q)} /> : null}
                {onCal && !live ? <DetailBtn icon="ti-calendar-off" label="Unschedule" onClick={() => act(q.id, "unschedule")} /> : null}
                <DetailBtn icon="ti-archive" label="Archive" onClick={() => act(q.id, "archive")} />
                {!live ? <DetailBtn icon="ti-trash" label="Delete" onClick={() => del(q.id)} danger /> : null}
                {q.url ? <a href={q.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11.5px] text-blue-600"><i className="ti ti-external-link" aria-hidden="true" /> View</a> : null}
              </div>
            </div>
            {editing ? (
              <div className="mt-3">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} className="w-full rounded-lg border border-slate-200 p-2 text-[13px]" />
                <div className="mt-1.5 flex gap-2">
                  <button type="button" onClick={() => act(q.id, "edit", { body: draft })} disabled={busy} className="rounded-md bg-indigo-600 px-3 py-1 text-[11.5px] font-medium text-white">Save</button>
                  <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-slate-200 px-3 py-1 text-[11.5px] text-slate-600">Cancel</button>
                </div>
              </div>
            ) : <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-600">{q.body}</p>}
          </div>
        );
      })() : <p className="mt-4 text-center text-[11.5px] text-slate-400">Select a post from the rail or calendar to edit, reschedule, or preview it.</p>}

      {/* status legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-slate-500">
        {[["Draft", "#64748B"], ["Parked", "#CA8A04"], ["Scheduled", "#16A34A"], ["Published", "#2563EB"], ["Failed", "#E11D48"]].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
        ))}
      </div>

      {scheduling ? (
        <div onClick={() => setScheduling(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-xl bg-white p-4 shadow-xl">
            <p className="text-[13px] font-semibold text-slate-800">{scheduling.scheduled_at ? "Reschedule post" : "Schedule post"}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{titleOf(scheduling)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div><p className="text-[10px] text-slate-400">Date</p><input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]" /></div>
              <div><p className="text-[10px] text-slate-400">Time</p><input type="time" value={sTime} onChange={(e) => setSTime(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]" /></div>
            </div>
            {googleReady ? <p className="mt-2 text-[10.5px] text-slate-400"><i className="ti ti-brand-google" aria-hidden="true" /> Adds to your Google Calendar.</p> : null}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setScheduling(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-600">Cancel</button>
              <button type="button" onClick={confirmSchedule} disabled={busy || !sDate} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? <PreviewModal onClose={() => setPreview(null)} name={preview.account_name ?? "Your account"} platform={platformOf(preview.account_name)} body={preview.body} comment={preview.comment_text} link={preview.link_url} /> : null}
    </div>
  );
}

function DetailBtn({ icon, label, onClick, accent, danger }: { icon: string; label: string; onClick: () => void; accent?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11.5px] ${danger ? "border-rose-200 text-rose-600" : accent ? "border-indigo-200 text-indigo-600" : "border-slate-200 text-slate-600"} hover:bg-slate-50`}>
      <i className={`ti ${icon}`} aria-hidden="true" /> {label}
    </button>
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
      <p className="mt-2 text-[11.5px] text-slate-400">Rotation: {settings.rotation.map((r) => r.replace(/_/g, " ")).join(" → ")}. Slots suggest posting times on the Schedule calendar.</p>

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
        <HealthRow label="LinkedIn Posts API" value={linkedInReady ? "ok" : "not connected"} ok={linkedInReady} />
        <HealthRow label="Facebook Graph API" value={facebookReady ? "ok · v21.0" : "not connected"} ok={facebookReady} />
        <HealthRow label="Failed last 24h" value={String(failed24)} ok={failed24 === 0} />
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">LinkedIn posts as a personal profile; Facebook posts to a Page feed with the tagged link as a comment. Page posting needs Meta App Review to go live — dev mode works on Pages you admin. Instagram is off for now.</p>
    </div>
  );
}

function HealthRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
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
