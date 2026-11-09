"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { ARCHETYPES, type Archetype } from "@/lib/social/composer";
import { SocialPreview } from "@/components/founder/social/SocialPreview";
import { NETWORKS, type Network } from "@/lib/social/templates";
import { DEPARTMENTS } from "@/lib/marketing/department-grouping";
import { POST_LIBRARY, fitLink } from "@/lib/social/post-library";
import type { SocialAccount, QueueItem, SocialSettings, SocialSlot } from "@/lib/social/queries";
import { accountName } from "@/lib/social/account-name";
import type { WeekBar } from "@/lib/social/attribution";
import { Overview } from "./Overview";
import { CampaignsGoals } from "./CampaignsGoals";
import { Library } from "./Library";
import { AlertRules } from "./AlertRules";
import { AttributionPeriods } from "./AttributionPeriods";
import { AiCmo } from "./AiCmo";
import { Accounts } from "./Accounts";
import { RedditReply } from "./RedditReply";
import { Finder, type RedditPrefill } from "./Finder";
import { SiteAuditCard } from "./SiteAuditCard";
import { fromPlatformInput, toPlatformInput } from "@/lib/time/platform-input";
import { OdooPager } from "@/components/admin/OdooPager";
import { MultiDatePicker } from "@/components/founder/social/MultiDatePicker";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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

type Tab = "overview" | "goals" | "finder" | "composer" | "schedule" | "library" | "attribution" | "settings";
const TAB_ORDER: Tab[] = ["overview", "goals", "finder", "composer", "schedule", "library", "attribution", "settings"];
const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview", goals: "Campaigns & Goals", finder: "Finder", composer: "Compose", schedule: "Schedule",
  library: "Library", attribution: "Attribution", settings: "Settings",
};

/** Display label + colors per variant status (parked/scheduled/published…). */
/** Plain-language note for a post that went live with a side issue (e.g. first comment). */
function publishedNote(error: string): string {
  if (/LinkedIn comment 403/.test(error) && /partnerApiSocialActions/.test(error)) {
    return "Note: the first comment was not posted. The LinkedIn app does not have comment access yet, so new LinkedIn posts carry the comment text in the post itself.";
  }
  return `Note: ${error.replace(/^Published — /, "")}`;
}

const GUIDE_HIDDEN_KEY = "admin-social-schedule-guide-hidden";
const GUIDE_STEPS: { title: string; body: string }[] = [
  { title: "Pick your dates", body: "In Compose, choose one or more days and a time, then tap Schedule. You land here with a post on every day you chose." },
  { title: "Check the board", body: "Each post sits on the day it goes out. Drag a post to another day to move it, or drag a draft from Unscheduled onto a day. It keeps its time of day." },
  { title: "Open a post", body: "Tap a post title to see Posted to: every account, its status, and a link to the live post once it is published." },
  { title: "Manage repeating posts", body: "Pause, resume or end a repeating series from the list under the board. Month, Week and List views are still one tap away." },
];

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

export function SocialHubClient({ accounts, queue, settings: settings0, slots: slots0, linkedInReady, facebookReady, redditReady = false, googleReady, attribution, initialTab, libraryCampaign = null, librarySince = null }: {
  accounts: SocialAccount[]; queue: QueueItem[]; settings: SocialSettings; slots: SocialSlot[]; linkedInReady: boolean; facebookReady: boolean; redditReady?: boolean; googleReady: boolean; attribution: WeekBar[];
  /** Deep links (?tab=library&campaign=…&since=…) — how Campaigns & Goals opens a stage or campaign in a new tab. */
  initialTab?: string; libraryCampaign?: string | null; librarySince?: string | null;
}) {
  const [composeMode, setComposeMode] = useState<"post" | "reddit">("post");
  const [redditPrefill, setRedditPrefill] = useState<RedditPrefill | null>(null);
  const [redditKey, setRedditKey] = useState(0);
  const [tab, setTab] = useState<Tab>(() => (TAB_ORDER as string[]).includes(initialTab ?? "") ? (initialTab as Tab) : "overview");
  const [goalsFocus, setGoalsFocus] = useState<{ campaignId?: string; stage?: string } | null>(null);
  // Set when Compose schedules posts: the queue ids that existed before, so Schedule can mark the new ones.
  const [justScheduled, setJustScheduled] = useState<{ count: number; before: string[] } | null>(null);
  const failed24 = queue.filter((q) => q.status === "failed").length;
  const topPostBody = queue.find((q) => q.status === "published" && q.body)?.body ?? null;
  const navigate = (t: string, focus?: { campaignId?: string; stage?: string }) => { if (t === "goals") setGoalsFocus(focus ?? null); setTab(t as Tab); };

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-slate-100">
        {TAB_ORDER.map((t) => (
          <button type="button" key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {TAB_LABELS[t]}{t === "schedule" && queue.length ? ` · ${queue.length}` : ""}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "overview" ? (
          <div className="space-y-5">
            <Overview failedCount={failed24} topPostBody={topPostBody} onNavigate={navigate} />
            <SiteAuditCard />
          </div>
        ) : null}
        {tab === "goals" ? <CampaignsGoals focus={goalsFocus} /> : null}
        {tab === "finder" ? <Finder onOpenReddit={(p) => { setRedditPrefill(p); setRedditKey((k) => k + 1); setComposeMode("reddit"); setTab("composer"); }} /> : null}
        {tab === "composer" ? (
          <div>
            <div className="mb-4 inline-flex rounded-lg border border-slate-200 p-0.5">
              {([["post", "Post", "ti-send"], ["reddit", "Reddit reply", "ti-brand-reddit"]] as const).map(([k, label, icon]) => (
                <button type="button" key={k} onClick={() => setComposeMode(k)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium ${composeMode === k ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700"}`}>
                  <i className={`ti ${icon}`} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
            {composeMode === "reddit" ? <RedditReply key={redditKey} prefill={redditPrefill} onPrefillUsed={() => setRedditPrefill(null)} /> : <Composer accounts={accounts} googleReady={googleReady} onScheduled={(count) => { setJustScheduled({ count, before: queue.map((q) => q.id) }); setTab("schedule"); }} />}
          </div>
        ) : null}
        {tab === "schedule" ? <Schedule queue={queue} accounts={accounts} slots={slots0} googleReady={googleReady} onAddPost={() => setTab("composer")} notice={justScheduled} onDismissNotice={() => setJustScheduled(null)} /> : null}
        {tab === "library" ? <Library campaignId={libraryCampaign} publishedSince={librarySince} /> : null}
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
            <Accounts accounts={accounts} linkedInReady={linkedInReady} facebookReady={facebookReady} redditReady={redditReady} failed24={failed24} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Composer({ accounts, googleReady, onScheduled }: { accounts: SocialAccount[]; googleReady: boolean; onScheduled: (count: number) => void }) {
  const [brief, setBrief] = useState("");
  const [archetype, setArchetype] = useState<Archetype>("proof_case");
  const [department, setDepartment] = useState<string>("Marketing");
  const [campaignId, setCampaignId] = useState<string>("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [newCampaign, setNewCampaign] = useState<{ open: boolean; name: string; budget: string }>({ open: false, name: "", budget: "" });
  const [selected, setSelected] = useState<string[]>(() => accounts.filter((a) => a.is_default).map((a) => a.id));   // default account pre-picked
  const [variants, setVariants] = useState<{ accountId: string; body: string }[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [agentLinks, setAgentLinks] = useState<Array<{ key: string; label: string; url: string }>>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [comment, setComment] = useState("");
  const [schedOn, setSchedOn] = useState(true);
  const [schedDates, setSchedDates] = useState<string[]>([]);   // one or more days, one post per day
  const [schedTime, setSchedTime] = useState("08:15");
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly" | "monthly">("none");   // series from the one picked date
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewNet, setPreviewNet] = useState<Network | null>(null);
  const [libOpen, setLibOpen] = useState(false);

   
  useEffect(() => { fetch("/api/admin/social/campaigns").then((r) => (r.ok ? r.json() : { campaigns: [] })).then((d) => setCampaigns((d.campaigns ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/admin/social/agent-links").then((r) => (r.ok ? r.json() : { links: [] })).then((d) => setAgentLinks(d.links ?? [])).catch(() => {}); }, []);

  async function saveNewCampaign() {
    const name = newCampaign.name.trim();
    if (!name) return;
    const budgetCents = Math.round((parseFloat(newCampaign.budget) || 0) * 100);
    const r = await fetch("/api/admin/social/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, budgetCents }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.campaign) { setCampaigns((p) => [{ id: j.campaign.id, name: j.campaign.name }, ...p]); setCampaignId(j.campaign.id); setNewCampaign({ open: false, name: "", budget: "" }); }
  }

  const nameOf = (id: string) => { const a = accounts.find((x) => x.id === id); return a ? accountName(a) : "Account"; };
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

  const isoFor = (d: string) => (fromPlatformInput(`${d}T${schedTime || "08:15"}`) ?? new Date(`${d}T${schedTime || "08:15"}`)).toISOString();

  async function save(mode: "draft" | "park" | "schedule" | "now") {
    if (variants.length === 0) return;
    // One post per picked day. Anything else saves a single post.
    const targets: (string | null)[] = mode === "schedule" ? schedDates.map(isoFor) : mode === "now" ? [new Date().toISOString()] : [null];
    if (mode === "schedule" && targets.length === 0) { setMsg("Pick at least one date and a time to schedule."); return; }
    setBusy(true); setMsg(null);
    let made = 0;
    let last: { queued?: number; parked?: number; postId?: string } = {};
    try {
      for (const scheduledAt of targets) {
        const res = await fetch("/api/admin/social/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief, archetype, department, campaignId: campaignId || null, linkUrl: linkUrl || null, imageUrl: imageUrl || null, comment: comment || null, approve: mode !== "draft", scheduledAt, variants }) });
        const j = await res.json();
        if (!res.ok) { setMsg(made > 0 ? `Scheduled ${made} of ${targets.length}. ${j.error ?? "The rest could not be saved."}` : j.error ?? "Save failed."); break; }
        last = j; made += 1;
      }
      if (made === 0) return;
      // Repeat: seed a series from the one scheduled post, the same way Schedule's "Make recurring" does.
      let repeatNote = "";
      if (mode === "schedule" && repeat !== "none" && targets.length === 1 && targets[0] && last.postId) {
        const when = new Date(targets[0]);
        const rr = await fetch("/api/admin/social/recurrences/from-post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: last.postId, freq: repeat, interval: 1, weekdays: repeat === "weekly" ? [when.getUTCDay()] : [], timeLocal: when.toISOString().slice(11, 16), startDate: when.toISOString().slice(0, 10), endType: "never", endDate: null, endCount: null }) });
        repeatNote = rr.ok ? ` Repeats ${repeat}.` : " The post is scheduled, but the repeat could not be set up. Use Make recurring on the Schedule tab.";
      }
      if (made === targets.length) setMsg(mode === "schedule" ? `Scheduled ${made} post${made === 1 ? "" : "s"}.${repeatNote}` : mode === "now" ? "Queued. It publishes within 5 minutes." : mode === "park" ? `Parked ${last.parked ?? made} post(s) in the queue.` : "Saved as draft.");
      setVariants([]); setBrief("");
      if (mode === "schedule") { setSchedDates([]); setRepeat("none"); onScheduled(made); }
    } finally { setBusy(false); }
  }

  // Live preview (right side): first draft variant, else the raw notes. Network follows the first account unless picked.
  const previewAccountId = variants[0]?.accountId ?? selected[0] ?? accounts[0]?.id ?? "";
  const accountNetwork = platformOf(previewAccountId);
  const previewNetwork: Network = previewNet ?? ((NETWORKS as readonly string[]).includes(accountNetwork) ? (accountNetwork as Network) : "linkedin");

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
    <div className="min-w-0 max-w-2xl">
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
              <button type="button" onClick={() => setArchetype(a.key)} className={`${chip} inline-flex items-center gap-1.5 ${archetype === a.key ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>
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
            return <button type="button" key={a.id} onClick={() => setSelected((p) => on ? p.filter((x) => x !== a.id) : [...p, a.id])} className={`${chip} inline-flex items-center gap-1.5 ${on ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}><i className={`ti ti-brand-${a.platform}`} aria-hidden="true" />{accountName(a)}{a.is_default ? <span className="text-[10px] opacity-60">default</span> : null}</button>;
          })}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={draft} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Drafting…" : "Draft it"}</button>
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
          {/* Attachments: an agent link (Johnny or a live founder IR agent) posts as the first comment with its tracked link. */}
          {agentLinks.length ? (
            <div className="mt-2">
              <p className="text-[12px] font-semibold text-slate-700">Attachments <span className="ml-1 rounded-full bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-teal-700">NEW</span></p>
              <div className="mt-1.5 flex flex-col gap-2">
                {agentLinks.map((a) => {
                  const on = a.url === linkUrl;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        if (on) { setLinkUrl(""); return; }
                        setLinkUrl(a.url);
                        if (!comment.trim()) setComment("Talk to our investor relations agent, any time →");
                      }}
                      className={`flex items-center justify-between rounded-xl border-2 px-3.5 py-2.5 text-left ${on ? "border-teal-600 bg-teal-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <span>
                        <span className="block text-[13px] font-semibold text-slate-800">{a.label}</span>
                        <span className="block text-[11.5px] text-slate-500">Tracks the social channel</span>
                      </span>
                      {on ? <i className="ti ti-circle-check text-[20px] text-teal-600" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">Posts as the first comment, tracked to this network. Clicks and chats count toward this post in Attribution.</p>
            </div>
          ) : null}
          {/* Instagram has no text-only posts: a public image URL is required for any Instagram variant. */}
          {(() => {
            const hasIg = selected.some((id) => platformOf(id) === "instagram");
            const badUrl = imageUrl.trim() !== "" && !/^https:\/\/\S+\.(jpe?g|png)(\?\S*)?$/i.test(imageUrl.trim());
            return (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={hasIg ? "Image URL — required for Instagram (public https JPEG/PNG)" : "Image URL (optional; public https JPEG/PNG)"} className={`flex-1 rounded-lg border px-3 py-2 text-[13px] focus:outline-none ${hasIg && !imageUrl.trim() ? "border-amber-300 bg-amber-50/40 focus:border-amber-400" : "border-slate-200 focus:border-indigo-400"}`} />
                  {/* eslint-disable-next-line @next/next/no-img-element -- user supplied URL, not a known image host */}
                  {imageUrl.trim() && !badUrl ? <img src={imageUrl.trim()} alt="" className="h-9 w-9 rounded-md border border-slate-200 object-cover" /> : null}
                </div>
                {badUrl ? <p className="mt-1 text-[11.5px] text-rose-600">Instagram needs a direct https link to a .jpg or .png file.</p>
                  : hasIg && !imageUrl.trim() ? <p className="mt-1 text-[11.5px] text-amber-700">Instagram only publishes image posts — add an image URL or the Instagram variant will fail.</p> : null}
              </div>
            );
          })()}

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
              {googleReady ? <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><i className="ti ti-brand-google" aria-hidden="true" /> mirrors to Google Calendar</span> : null}
            </div>
            {schedOn ? <div className="mt-2"><MultiDatePicker dates={schedDates} onDates={setSchedDates} time={schedTime} onTime={setSchedTime} /></div> : null}
            {schedOn ? (
              <div className="mt-3">
                <label htmlFor="admin-compose-repeat" className="text-[12px] font-medium text-slate-700">Repeat</label>
                <select id="admin-compose-repeat" value={schedDates.length === 1 ? repeat : "none"} disabled={schedDates.length !== 1} onChange={(e) => setRepeat(e.target.value as typeof repeat)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] disabled:opacity-50">
                  <option value="none">Does not repeat</option>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                </select>
                {schedDates.length !== 1 ? <p className="mt-1 text-[11px] text-slate-400">Repeat works when exactly one date is picked.</p> : null}
              </div>
            ) : null}
            <p className="mt-1.5 text-[11px] text-slate-400">Toggle off to park the post in the queue without a date — you can schedule it later from the Schedule tab.</p>
          </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowPreview(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"><i className="ti ti-eye" aria-hidden="true" /> Preview</button>
            <button type="button" onClick={() => save("draft")} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-50">Save draft</button>
            <button type="button" onClick={() => save("park")} disabled={busy} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 disabled:opacity-50">Park in Queue</button>
            <button type="button" onClick={() => { if (confirm("Post now? It goes out to every selected account within 5 minutes.")) void save("now"); }} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-50">Post now</button>
            <button type="button" onClick={() => save("schedule")} disabled={busy || !schedOn || schedDates.length === 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{schedDates.length > 1 ? `Schedule ${schedDates.length} posts` : "Schedule post"}</button>
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
    <aside className="min-w-0 xl:sticky xl:top-4" aria-label="Post preview">
      <SocialPreview body={variants[0]?.body ?? brief} network={previewNetwork} onNetwork={setPreviewNet} name={previewAccountId ? nameOf(previewAccountId) : "Your account"} company={null} linkUrl={linkUrl} firstComment={comment.trim() || null} />
    </aside>
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
/** Pacific date and time of an instant (the Social Hub shows PT). */
const ptYmd = (d: Date) => toPlatformInput(d).slice(0, 10);
const ptHm = (d: Date) => toPlatformInput(d).slice(11, 16);
/** Pacific time of an instant as 3:00 PM PT. */
const ptTime12 = (iso: string) => { const [h, m] = ptHm(new Date(iso)).split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"} PT`; };
const dayLabel = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
/** Schedule surface card: soft, borderless. */
const sCard = "rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/60";
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Schedule({ queue: initial, accounts, slots, googleReady, onAddPost, notice = null, onDismissNotice }: { queue: QueueItem[]; accounts: SocialAccount[]; slots: SocialSlot[]; googleReady: boolean; onAddPost: () => void; notice?: { count: number; before: string[] } | null; onDismissNotice?: () => void }) {
  const [queue, setQueue] = useState<QueueItem[]>(initial);
  const [guideHidden, setGuideHidden] = useState(false);
  // The guide stays open until it is hidden. Read after mount so the first render matches the server.
  useEffect(() => { const t = setTimeout(() => { try { setGuideHidden(localStorage.getItem(GUIDE_HIDDEN_KEY) === "1"); } catch { /* storage unavailable */ } }, 0); return () => clearTimeout(t); }, []);
  const toggleGuide = () => setGuideHidden((h) => { try { localStorage.setItem(GUIDE_HIDDEN_KEY, h ? "0" : "1"); } catch { /* storage unavailable */ } return !h; });
  const [view, setView] = useState<"board" | "month" | "week" | "list">("board");
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
  const [recSummary, setRecSummary] = useState<{ label: string; status: string; madeCount: number; accountIds?: string[] } | null>(null);
  // Repeating series shown under the board: summaries keyed by recurrence id.
  const [series, setSeries] = useState<Record<string, { label: string; status: string; madeCount: number }>>({});
  // Calendar account filter: "all" or one account id.
  const [acctFilter, setAcctFilter] = useState<string>("all");
  const [acctMsg, setAcctMsg] = useState<string | null>(null);
  // Phone month view: the tapped day, whose posts list under the grid.
  const [selDay, setSelDay] = useState<string>(() => ptYmd(new Date()));
  // Google-style "delete recurring post" scope dialog.
  const [recDelete, setRecDelete] = useState<QueueItem | null>(null);
  const [recDeleteScope, setRecDeleteScope] = useState<"this" | "following" | "all">("this");
  // Google-style "edit recurring post" scope dialog + the series time field in the editor.
  const [recEdit, setRecEdit] = useState<QueueItem | null>(null);
  const [recEditScope, setRecEditScope] = useState<"this" | "following" | "all">("all");
  const [editTime, setEditTime] = useState("");
  // "Make recurring" panel state (for non-series posts).
  const [mrOpen, setMrOpen] = useState(false);
  const [mrFreq, setMrFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [mrInterval, setMrInterval] = useState("1");
  const [mrWeekdays, setMrWeekdays] = useState<number[]>([]);
  const [mrEndType, setMrEndType] = useState<"never" | "on_date" | "after">("never");
  const [mrEndDate, setMrEndDate] = useState("");
  const [mrEndCount, setMrEndCount] = useState("12");
  const [mrPreview, setMrPreview] = useState<{ upcoming: number[]; total: number } | null>(null);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [assignTo, setAssignTo] = useState<string>("");
   
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

  const shown = acctFilter === "all" ? queue : queue.filter((q) => q.account_id === acctFilter);
  const rail = shown.filter((q) => !itemISO(q));
  const dated = shown.filter((q) => itemISO(q));
  const newIds = notice ? queue.filter((q) => itemISO(q) && !notice.before.includes(q.id)).map((q) => q.id) : [];
  const publishedOn = (id: string | null) => queue.filter((q) => q.status === "published" && (id === null || q.account_id === id)).length;

  const byDay = useMemo(() => {
    const m = new Map<string, QueueItem[]>();
    for (const q of dated) { const iso = itemISO(q)!; const k = ptYmd(new Date(iso)); (m.get(k) ?? m.set(k, []).get(k)!).push(q); }
    for (const list of m.values()) list.sort((a, b) => (itemISO(a)! < itemISO(b)! ? -1 : 1));
    return m;
  }, [dated]);

  // Weekdays in the next 14 days with no scheduled or published post (respects the account filter).
  const gapDays = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i);
      const key = ptYmd(d);
      const wd = new Date(`${key}T12:00:00`).getDay();
      if (wd === 0 || wd === 6) continue;
      const has = (byDay.get(key) ?? []).some((q) => q.status === "queued" || q.status === "published" || q.status === "publishing");
      if (!has) out.push({ key, label: `${WD[wd]} ${Number(key.slice(8, 10))}` });
    }
    return out;
  }, [byDay]);
  const gapSet = useMemo(() => new Set(gapDays.map((g) => g.key)), [gapDays]);
  // Board: the next 14 days (Pacific), posts past that window go under "Later".
  const boardDays = useMemo(() => {
    const out: string[] = []; const base = new Date();
    for (let i = 0; i < 14; i++) out.push(ptYmd(new Date(base.getTime() + i * 86_400_000)));
    return [...new Set(out)];
  }, []);
  const laterPosts = useMemo(() => {
    const last = boardDays[boardDays.length - 1];
    return dated.filter((q) => q.status !== "published" && ptYmd(new Date(itemISO(q)!)) > last);
  }, [dated, boardDays]);
  const seriesIds = useMemo(() => [...new Set(queue.map((q) => q.recurrence_id).filter((x): x is string => Boolean(x)))], [queue]);
  useEffect(() => {
    let live = true;
    for (const id of seriesIds) {
      if (series[id]) continue;
      fetch(`/api/admin/social/recurrences/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d?.summary) setSeries((cur) => ({ ...cur, [id]: d.summary })); }).catch(() => {});
    }
    return () => { live = false; };
  }, [seriesIds, series]);
  async function seriesAct(id: string, action: "pause" | "resume" | "end") {
    await recAct(id, action);
    const d = await fetch(`/api/admin/social/recurrences/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d?.summary) setSeries((cur) => ({ ...cur, [id]: d.summary }));
  }

  async function reload() {
    try { const r = await fetch("/api/admin/social/queue"); if (r.ok) { const nq: QueueItem[] = (await r.json()).queue ?? []; setQueue(nq); setSelected((s) => (s ? nq.find((x) => x.id === s.id) ?? null : null)); } } catch { /* keep */ }
  }
  // Arriving from Compose: the queue prop is from before the new posts, so fetch it again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (notice) { const t = setTimeout(() => void reload(), 0); return () => clearTimeout(t); } }, []);
  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/social/queue/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      if (r.ok) { setEditing(false); setScheduling(null); await reload(); } else { alert((await r.json()).error ?? "Failed."); }
    } finally { setBusy(false); }
  }
  // "Post here too": queue this post for one more account.
  async function addAccount(postId: string, accountId: string) {
    setBusy(true); setAcctMsg(null);
    try {
      const r = await fetch("/api/admin/social/posts/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, accountId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setAcctMsg(j.error ?? "Couldn't add the account.");
      await reload();
    } finally { setBusy(false); }
  }
  // Series "Posts to" picker: future posts in the series follow the ticked accounts.
  async function setSeriesAccounts(recurrenceId: string, accountIds: string[]) {
    if (accountIds.length === 0) { setAcctMsg("A series needs at least one account."); return; }
    setBusy(true); setAcctMsg(null);
    try {
      const r = await fetch(`/api/admin/social/recurrences/${recurrenceId}/accounts`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountIds }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setAcctMsg(j.error ?? "Couldn't update the series."); return; }
      setRecSummary((cur) => (cur ? { ...cur, accountIds } : cur));
      setAcctMsg(`Series updated: ${j.added ?? 0} upcoming post${j.added === 1 ? "" : "s"} added, ${j.removed ?? 0} removed.`);
      await reload();
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
  // Build a recurrence rule for the "Make recurring" panel, seeded from the selected post's time.
  function mrRule(q: QueueItem) {
    const iso = itemISO(q);
    // Recurrences are generated on the server in UTC, so seed the rule with the UTC parts of the post time.
    const timeLocal = iso ? new Date(iso).toISOString().slice(11, 16) : "08:15";
    const today = iso ? new Date(iso) : new Date(); const startDate = today.toISOString().slice(0, 10);
    return {
      freq: mrFreq, interval: Math.max(1, parseInt(mrInterval, 10) || 1),
      weekdays: mrFreq === "weekly" ? (mrWeekdays.length ? mrWeekdays : [today.getUTCDay()]) : [],
      timeLocal, startDate,
      endType: mrEndType, endDate: mrEndType === "on_date" ? (mrEndDate || null) : null,
      endCount: mrEndType === "after" ? (Math.max(1, parseInt(mrEndCount, 10) || 1)) : null,
    };
  }
  async function mrPreviewFor(q: QueueItem) {
    try { const r = await fetch("/api/admin/social/recurrences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...mrRule(q), dryRun: true }) }); const d = await r.json(); setMrPreview({ upcoming: d.upcoming ?? [], total: d.total ?? 0 }); } catch { setMrPreview(null); }
  }
  async function startSeries(q: QueueItem) {
    if (!q.post_id) { alert("This post can't be made recurring."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/social/recurrences/from-post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: q.post_id, ...mrRule(q) }) });
      if (r.ok) { setMrOpen(false); setMrPreview(null); await reload(); } else { alert((await r.json()).error ?? "Could not create series."); }
    } finally { setBusy(false); }
  }
  const MR_WEEKDAYS: { l: string; d: number }[] = [{ l: "S", d: 0 }, { l: "M", d: 1 }, { l: "T", d: 2 }, { l: "W", d: 3 }, { l: "T", d: 4 }, { l: "F", d: 5 }, { l: "S", d: 6 }];
  async function deleteRecurring(q: QueueItem, scope: "this" | "following" | "all") {
    if (!q.recurrence_id) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/social/recurrences/${q.recurrence_id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, postId: q.post_id, from: itemISO(q) }) });
      if (!r.ok) { alert((await r.json().catch(() => ({}))).error ?? "Could not delete."); return; }
      setRecDelete(null); setSelected(null); await reload();
    } finally { setBusy(false); }
  }
  const localHHMM = (iso: string | null) => { if (!iso) return ""; return ptHm(new Date(iso)); };
  const toMin = (t: string) => { const [h, m] = t.split(":").map((n) => parseInt(n, 10)); return (h || 0) * 60 + (m || 0); };
  // What the series editor would change: new copy and/or a same-day time shift in minutes.
  function recEditChanges(q: QueueItem) {
    const body = draft.trim() && draft.trim() !== q.body.trim() ? draft.trim() : null;
    const oldT = localHHMM(itemISO(q));
    const deltaMin = oldT && editTime && editTime !== oldT ? toMin(editTime) - toMin(oldT) : 0;
    return { body, deltaMin };
  }
  function saveEdit(q: QueueItem) {
    if (!draft.trim()) { alert("Body can't be empty."); return; }
    if (!q.recurrence_id) { void act(q.id, "edit", { body: draft }); return; }
    const { body, deltaMin } = recEditChanges(q);
    if (!body && !deltaMin) { setEditing(false); return; }
    setRecEditScope("all"); setRecEdit(q);
  }
  async function editRecurring(q: QueueItem, scope: "this" | "following" | "all") {
    if (!q.recurrence_id) return;
    const { body, deltaMin } = recEditChanges(q);
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/social/recurrences/${q.recurrence_id}/edit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, variantId: q.id, body, deltaMin: deltaMin || null }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error ?? "Could not update the series."); return; }
      setRecEdit(null); setEditing(false); await reload();
      const s = await fetch(`/api/admin/social/recurrences/${q.recurrence_id}`).then((x) => x.json()).catch(() => ({}));
      setRecSummary(s.summary ?? null);
      if (d.skipped) alert(`${d.skipped} post${d.skipped === 1 ? " was" : "s were"} already published or publishing, so ${d.skipped === 1 ? "it was" : "they were"} left as is.`);
    } finally { setBusy(false); }
  }
  async function recAct(id: string, action: "pause" | "resume" | "end") {
    if (action === "end" && !confirm("End this recurring series? Already-scheduled occurrences stay; no new ones are created.")) return;
    setBusy(true);
    try { await fetch(`/api/admin/social/recurrences/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); await reload(); const r = await fetch(`/api/admin/social/recurrences/${id}`).then((x) => x.json()).catch(() => ({})); setRecSummary(r.summary ?? null); } finally { setBusy(false); }
  }
  function openSchedule(q: QueueItem) {
    const base = q.scheduled_at ? new Date(q.scheduled_at) : null;
    setSDate(base ? ptYmd(base) : ""); setSTime(base ? ptHm(base) : defaultTime);
    setScheduling(q);
  }
  function confirmSchedule() {
    if (!scheduling || !sDate) return;
    act(scheduling.id, "schedule", { scheduledAt: (fromPlatformInput(`${sDate}T${sTime || defaultTime}`) ?? new Date(`${sDate}T${sTime || defaultTime}`)).toISOString() });
  }
  // Drop a dragged post onto a day: keep its existing time if it had one, else the default slot time.
  function dropOnDay(dateKey: string) {
    const id = dragId; setDragId(null); setOverKey(null);
    if (!id) return;
    const q = queue.find((x) => x.id === id);
    if (!q || q.status === "published") return;
    const base = q.scheduled_at ? new Date(q.scheduled_at) : null;
    const time = base ? ptHm(base) : defaultTime;
    act(id, "schedule", { scheduledAt: (fromPlatformInput(`${dateKey}T${time}`) ?? new Date(`${dateKey}T${time}`)).toISOString() });
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

  // One post on the board: title opens the detail, Change time reuses the existing reschedule dialog.
  const boardPost = (q: QueueItem, withDate = false) => {
    const sm = statusMeta(q.status); const iso = itemISO(q)!;
    return (
      <div key={q.id} {...dragProps(q)} className={`rounded-xl bg-white p-2.5 text-[12px] shadow-sm ring-1 ring-stone-200/70 ${q.status === "published" ? "" : "cursor-grab active:cursor-grabbing"} ${dragId === q.id ? "opacity-40" : ""}`}>
        <button type="button" onClick={() => { setSelected(q); setEditing(false); }} className="block w-full truncate text-left font-semibold text-slate-800">{q.recurrence_id ? "↻ " : ""}{titleOf(q)}</button>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{withDate ? `${dayLabel(ptYmd(new Date(iso)))} · ` : ""}{ptTime12(iso)} · {q.account_name ?? q.platform ?? "Account"}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.dot }} />{sm.label}</p>
        {q.status !== "published" ? <button type="button" onClick={() => openSchedule(q)} className="mt-1 text-[11px] font-semibold text-teal-700 hover:underline">Change time</button> : null}
      </div>
    );
  };

  // month grid (Monday-first)
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const todayKey = ptYmd(new Date());

  // week (Monday-first, containing anchor)
  const weekStart = (() => { const d = new Date(anchor); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; })();
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const weekEnd = weekDays[6];
  const shift = (dir: number) => setAnchor((a) => { const d = new Date(a); if (view === "week") d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir); return d; });
  const label = view === "month" ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} – ${weekStart.getMonth() === weekEnd.getMonth() ? "" : MONTHS[weekEnd.getMonth()].slice(0, 3) + " "}${weekEnd.getDate()}`;

  return (
    <div>
      {notice ? (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white"><i className="ti ti-check" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-emerald-900">Done! {notice.count === 1 ? "Your post is scheduled." : `Your ${notice.count} posts are scheduled.`}</p>
            <p className="text-[12px] text-emerald-800">New posts are marked NEW on the calendar. Click one to see where it posts.</p>
          </div>
          {newIds.length > 0 ? <button type="button" onClick={() => { const q = queue.find((x) => x.id === newIds[0]); if (q) { setSelected(q); setEditing(false); } }} className="rounded-lg bg-emerald-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-emerald-800">See your posting here</button> : null}
          <button type="button" aria-label="Dismiss message" onClick={onDismissNotice} className="px-2 py-1 text-emerald-800 hover:text-emerald-950"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
      ) : null}

      {/* how to use */}
      <div className="mb-4 rounded-2xl bg-teal-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-teal-900">How to use Schedule</p>
          <button type="button" aria-expanded={!guideHidden} onClick={toggleGuide} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-600 hover:bg-slate-50">{guideHidden ? "Show guide" : "Hide guide"}</button>
        </div>
        {!guideHidden ? (
          <ol className="mt-3 grid gap-3 md:grid-cols-2">
            {GUIDE_STEPS.map((g, i) => (
              <li key={g.title} className="flex gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-semibold text-white">{i + 1}</span>
                <div><p className="text-[12.5px] font-semibold text-slate-800">{g.title}</p><p className="text-[11.5px] text-slate-600">{g.body}</p></div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {view === "month" || view === "week" ? (
            <>
              <span className="text-[15px] font-semibold text-slate-800">{label}</span>
              <button type="button" onClick={() => shift(-1)} className="rounded-md border border-slate-200 px-2 py-0.5 text-slate-500 hover:bg-slate-50"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
              <button type="button" onClick={() => shift(1)} className="rounded-md border border-slate-200 px-2 py-0.5 text-slate-500 hover:bg-slate-50"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
              <button type="button" onClick={() => setAnchor(new Date())} className="rounded-md border border-slate-200 px-2.5 py-0.5 text-[12px] text-slate-500 hover:bg-slate-50">Today</button>
            </>
          ) : <span className="text-[15px] font-semibold text-slate-800">{view === "board" ? "Next 14 days" : "All posts"}</span>}
          <span className="ml-1 inline-flex overflow-hidden rounded-lg border border-slate-200 text-[12px]">
            {(["board", "month", "week", "list"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? "bg-teal-600 text-white" : "text-slate-500"}`}>{v}</button>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] ${googleReady ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${googleReady ? "bg-emerald-500" : "bg-slate-300"}`} />{googleReady ? "Google Calendar synced" : "Calendar not connected"}
          </span>
          <button type="button" onClick={onAddPost} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-teal-700"><i className="ti ti-plus" aria-hidden="true" /> Add post</button>
        </div>
      </div>

      {/* gap banner: weekdays coming up with nothing planned */}
      {view !== "list" ? (
        gapDays.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <span><b>{gapDays.length} weekday{gapDays.length === 1 ? "" : "s"} with no posts</b> in the next 14 days ({gapDays.map((g) => g.label).join(", ")}).</span>
            <button type="button" onClick={onAddPost} className="font-semibold text-teal-600 hover:underline">Add post</button>
          </div>
        ) : <p className="mb-3 text-[11.5px] text-emerald-700">Every weekday in the next 14 days has a post.</p>
      ) : null}

      {/* account filter: dropdown on phones, chips from md up */}
      {accounts.length > 1 ? (
        <select value={acctFilter} onChange={(e) => setAcctFilter(e.target.value)} aria-label="Show posts for" className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] md:hidden">
          <option value="all">All accounts · {publishedOn(null)}</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{accountName(a)} · {publishedOn(a.id)}</option>)}
        </select>
      ) : null}
      {accounts.length > 1 ? (
        <div className="mb-3 hidden flex-wrap items-center gap-1.5 md:flex" role="group" aria-label="Show posts for">
          {[{ id: "all", name: "All accounts", platform: null as string | null, n: publishedOn(null) },
            ...accounts.map((a) => ({ id: a.id, name: accountName(a), platform: a.platform as string | null, n: publishedOn(a.id) }))].map((c) => (
            <button key={c.id} type="button" aria-pressed={acctFilter === c.id} onClick={() => setAcctFilter(c.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${acctFilter === c.id ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              title={`${c.n} published`}>
              {c.platform ? <i className={`ti ti-brand-${c.platform}`} aria-hidden="true" /> : null}{c.name}<span className="tabular-nums opacity-70">{c.n}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
        {/* unscheduled rail */}
        <div className={`${sCard} h-max overflow-hidden`}>
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[12px] font-semibold text-slate-700">Unscheduled · {rail.length}</p>
            <p className="text-[10.5px] text-slate-400">{view === "list" ? "Approved & drafts awaiting a date" : "Drag onto a day to schedule"}</p>
          </div>
          <div className="flex flex-col gap-2 p-2">
            {rail.length === 0 ? <p className="px-1 py-3 text-center text-[11.5px] text-slate-400">Nothing parked.</p> : rail.map((q) => {
              const sm = statusMeta(q.status);
              return (
                <div key={q.id} {...dragProps(q)} onClick={() => { setSelected(q); setEditing(false); }} className={`cursor-grab rounded-lg border px-2.5 py-2 text-left active:cursor-grabbing ${selected?.id === q.id ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"} ${dragId === q.id ? "opacity-40" : ""}`}>
                  <p className="truncate text-[11.5px] font-medium text-slate-800"><i className="ti ti-grip-vertical mr-0.5 text-slate-300" aria-hidden="true" />{titleOf(q)}</p>
                  <p className="mt-1 flex items-center gap-1 text-[9.5px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.dot }} />{sm.label} · {q.account_name ?? q.platform ?? "—"}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* calendar / week / list */}
        {view === "board" ? (
          <div className="min-w-0">
            <p className="mb-2 text-[11.5px] text-slate-500">Drag a post to another day to reschedule it. It keeps its time of day. All times are Pacific (PT).</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boardDays.map((key) => {
                const items = byDay.get(key) ?? [];
                const over = overKey === key && dragId;
                return (
                  <div key={key} {...dropProps(key)} className={`min-h-[96px] rounded-2xl p-3 ${over ? "bg-teal-50 ring-2 ring-teal-400" : gapSet.has(key) ? "bg-amber-50 outline outline-1 -outline-offset-1 outline-dashed outline-amber-300" : "bg-stone-50"}`}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">{dayLabel(key)}</p>
                    {items.length === 0 ? <p className="text-[11px] text-stone-400">{dragId ? "Drop here" : "No posts"}</p> : (
                      <div className="space-y-2">{items.map((q) => boardPost(q))}</div>
                    )}
                  </div>
                );
              })}
            </div>
            {laterPosts.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Later</p>
                <div className="grid gap-2 sm:grid-cols-2">{laterPosts.map((q) => boardPost(q, true))}</div>
              </div>
            ) : null}
            {seriesIds.length > 0 ? (
              <div className={`${sCard} mt-5 p-4`}>
                <h3 className="text-[15px] font-semibold text-slate-800">Repeating posts</h3>
                <div className="mt-2 space-y-2">
                  {seriesIds.map((id) => {
                    const sm = series[id]; const first = queue.find((q) => q.recurrence_id === id);
                    return (
                      <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-slate-800">{first ? titleOf(first) : "Repeating post"}</p>
                          <p className="text-[11.5px] text-slate-500">{sm ? `${sm.label} · ${sm.madeCount} made${sm.status === "active" ? "" : ` · ${sm.status}`}` : "Loading"}</p>
                        </div>
                        {sm && sm.status !== "ended" ? (
                          <div className="flex items-center gap-2">
                            {sm.status === "paused"
                              ? <button type="button" disabled={busy} onClick={() => void seriesAct(id, "resume")} className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-teal-700 shadow-sm ring-1 ring-stone-200">Resume</button>
                              : <button type="button" disabled={busy} onClick={() => void seriesAct(id, "pause")} className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-teal-700 shadow-sm ring-1 ring-stone-200">Pause</button>}
                            <button type="button" disabled={busy} onClick={() => void seriesAct(id, "end")} className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-600 shadow-sm ring-1 ring-stone-200">End series</button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : view === "month" ? (
          <div className="min-w-0">
          <div className={`${sCard} overflow-hidden`}>
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
                  <div key={i} {...(inMonth ? dropProps(key) : {})} onClick={inMonth ? () => setSelDay(key) : undefined} className={`min-h-[56px] border-b border-l border-slate-100 p-1 md:min-h-[76px] ${i % 7 === 0 ? "border-l-0" : ""} ${!inMonth ? "bg-slate-50/60" : ""} ${inMonth && gapSet.has(key) && !over ? "bg-[repeating-linear-gradient(45deg,rgba(251,191,36,0.10)_0_8px,transparent_8px_16px)]" : ""} ${over ? "bg-emerald-50 ring-1 ring-inset ring-emerald-400" : ""}`}>
                    <div className={`text-[9.5px] ${key === todayKey ? "font-semibold text-teal-600" : "text-slate-400"} ${inMonth && key === selDay ? "underline decoration-teal-400 underline-offset-2 md:no-underline" : ""}`}>{inMonth ? dayNum : ""}</div>
                    {items.length > 0 ? (
                      <div className="mt-0.5 flex flex-wrap gap-0.5 md:hidden" aria-hidden="true">
                        {items.slice(0, 4).map((q) => <span key={q.id} className="h-1.5 w-1.5 rounded-full" style={{ background: q.event_color ?? statusMeta(q.status).dot }} />)}
                      </div>
                    ) : null}
                    {items.map((q) => {
                      const sm = statusMeta(q.status);
                      const iso = itemISO(q)!;
                      return (
                        <div key={q.id} {...dragProps(q)} onClick={() => { setSelected(q); setEditing(false); }} className={`mt-0.5 hidden w-full cursor-pointer rounded border-l-2 px-1 py-0.5 text-left text-[9px] leading-tight md:block ${dragId === q.id ? "opacity-40" : ""}`} style={{ borderColor: q.event_color ?? sm.dot, background: `${q.event_color ?? sm.dot}14` }}>
                          <span className="font-medium text-slate-700">{hhmm(iso)} {newIds.includes(q.id) ? <b className="rounded bg-amber-100 px-0.5 text-amber-800">NEW</b> : null} {q.recurrence_id ? "↻ " : ""}{titleOf(q).slice(0, 16)}</span><br />
                          <span style={{ color: q.event_color ?? sm.dot }}>{q.busy ? "●" : "○"} {sm.label}{!q.busy ? " · free" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          {(() => {
            const dayItems = byDay.get(selDay) ?? [];
            const dayLabel = new Date(`${selDay}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
            return (
              <div className={`${sCard} mt-3 p-3 md:hidden`}>
                <p className="text-[12.5px] font-semibold text-slate-800">{dayLabel} <span className="font-normal text-slate-400">· {dayItems.length} post{dayItems.length === 1 ? "" : "s"}</span></p>
                {dayItems.length === 0 ? (
                  <p className="mt-1 text-[11.5px] text-slate-400">No posts planned. <button type="button" onClick={onAddPost} className="font-medium text-teal-600">Add post</button></p>
                ) : dayItems.map((q) => {
                  const sm = statusMeta(q.status);
                  return (
                    <button key={q.id} type="button" onClick={() => { setSelected(q); setEditing(false); }} className="mt-2 flex w-full items-start gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-left" style={{ borderLeft: `3px solid ${q.event_color ?? sm.dot}` }}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-slate-800">{titleOf(q)}</span>
                        <span className="mt-0.5 block text-[10.5px] text-slate-500">{hhmm(itemISO(q)!)} · {q.account_name ?? q.platform ?? "—"} · {sm.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
          </div>
        ) : view === "week" ? (
          <div className={`${sCard} grid grid-cols-2 overflow-hidden sm:grid-cols-4 lg:grid-cols-7`}>
            {weekDays.map((d) => {
              const key = ymd(d); const items = byDay.get(key) ?? []; const over = overKey === key && dragId;
              return (
                <div key={key} {...dropProps(key)} className={`min-h-[160px] border-b border-l border-slate-100 first:border-l-0 ${over ? "bg-emerald-50 ring-1 ring-inset ring-emerald-400" : ""}`}>
                  <div className={`border-b border-slate-100 px-2 py-1.5 text-[10.5px] ${key === todayKey ? "font-semibold text-teal-600" : "text-slate-500"}`}>{WD[d.getDay()]} {d.getDate()}</div>
                  <div className="flex flex-col gap-1 p-1.5">
                    {items.length === 0 ? <span className="px-1 text-[9.5px] text-slate-300">{dragId ? "drop here" : "—"}</span> : items.map((q) => {
                      const sm = statusMeta(q.status); const iso = itemISO(q)!;
                      return (
                        <div key={q.id} {...dragProps(q)} onClick={() => { setSelected(q); setEditing(false); }} className={`cursor-pointer rounded border-l-2 px-1.5 py-1 text-[10px] leading-tight ${dragId === q.id ? "opacity-40" : ""}`} style={{ borderColor: q.event_color ?? sm.dot, background: `${q.event_color ?? sm.dot}14` }}>
                          <span className="font-medium text-slate-700">{hhmm(iso)}</span> {newIds.includes(q.id) ? <b className="rounded bg-amber-100 px-0.5 text-amber-800">NEW</b> : null} {q.recurrence_id ? "↻ " : ""}{titleOf(q).slice(0, 22)}<br />
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
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[13px] text-teal-800">
                <b>{selPosts.size} selected</b>
                <span>Assign to campaign</span>
                <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="rounded-md border border-teal-200 bg-white px-2 py-1 text-[12.5px]">
                  <option value="">None (clear)</option>
                  {camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => void assignCampaign()} disabled={busy} className="rounded-md bg-teal-600 px-3 py-1 text-[12.5px] font-medium text-white disabled:opacity-50">Apply</button>
                <button type="button" onClick={() => setSelPosts(new Set())} className="ml-auto text-[12px] text-teal-500">Clear</button>
              </div>
            ) : null}
            <div className={`${sCard} divide-y divide-slate-100`}>
            {dated.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-slate-400">No scheduled or published posts yet.</p> : [...dated].sort((a, b) => (itemISO(a)! < itemISO(b)! ? 1 : -1)).map((q) => {
              const sm = statusMeta(q.status); const iso = itemISO(q)!;
              return (
                <div key={q.id} className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  {q.post_id ? <input type="checkbox" checked={selPosts.has(q.post_id)} onChange={() => toggleSel(q.post_id!)} className="h-3.5 w-3.5 shrink-0" aria-label="Select post" /> : <span className="w-3.5" />}
                  <button type="button" onClick={() => { setSelected(q); setEditing(false); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-800">{titleOf(q)}</span>
                    {q.campaign_name ? <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] text-teal-700">{q.campaign_name}</span> : null}
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
        // Record pager (Odoo style): dated posts oldest to newest, then the unscheduled ones; wraps around.
        const order = [...dated].sort((a, b) => (itemISO(a)! < itemISO(b)! ? -1 : 1)).concat(rail);
        const pos = order.findIndex((x) => x.id === q.id);
        const go = (d: number) => { if (order.length < 2 || pos < 0) return; setSelected(order[(pos + d + order.length) % order.length]); setEditing(false); };
        return (
          <div onClick={() => { setSelected(null); setEditing(false); }} className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
          <div role="dialog" aria-modal="true" aria-label="Post details" onClick={(e) => e.stopPropagation()} className={`${sCard} relative w-full max-w-2xl p-4 pr-12 shadow-2xl`}>
            <button type="button" aria-label="Close" onClick={() => { setSelected(null); setEditing(false); }} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"><i className="ti ti-x" aria-hidden="true" /></button>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-800">{titleOf(q)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sm.cls}`}>● {sm.label}</span>
                  {pos >= 0 && order.length > 1 ? <OdooPager className="ml-2" label={`${pos + 1} / ${order.length}`} prev={{ onClick: () => go(-1) }} next={{ onClick: () => go(1) }} /> : null}
                </div>
                <p className="mt-1 text-[11.5px] text-slate-500">{q.account_name ?? q.platform ?? "—"}{iso ? ` · ${new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : " · no date"}</p>
                {q.error ? <p className={`mt-1 text-[11px] ${live ? "text-amber-700" : "text-rose-600"}`}>{live ? publishedNote(q.error) : q.error}</p> : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10.5px] text-slate-400 hover:text-slate-600">Calendar options (event color, busy or free)</summary>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] text-slate-400">Event color</span>
                  {["#1A6CE4", "#185FA5", "#0F6E56", "#CA8A04", "#A32D2D"].map((c) => (
                    <button key={c} type="button" aria-label={`Set color ${c}`} onClick={() => void setStyle(q.id, { color: c })}
                      className="h-4 w-4 rounded-full ring-offset-1" style={{ background: c, boxShadow: q.event_color === c ? `0 0 0 2px #fff, 0 0 0 3px ${c}` : "none" }} />
                  ))}
                  <button type="button" onClick={() => void setStyle(q.id, { color: null })} className="text-[10px] text-slate-400 hover:text-slate-600">by campaign</button>
                  <span className="ml-2 text-[10.5px] text-slate-400">·</span>
                  <button type="button" onClick={() => void setStyle(q.id, { busy: true })} className={`rounded px-2 py-0.5 text-[10px] ${q.busy ? "bg-rose-50 text-rose-700" : "text-slate-500"}`}>● Busy</button>
                  <button type="button" onClick={() => void setStyle(q.id, { busy: false })} className={`rounded px-2 py-0.5 text-[10px] ${!q.busy ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}>○ Free</button>
                </div>
                </details>
                {q.recurrence_id && recSummary ? (
                  <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50/50 px-2.5 py-2">
                    <div className="text-[11.5px] text-teal-700"><i className="ti ti-repeat" aria-hidden="true" /> <b className="font-semibold">{recSummary.label}</b> {recSummary.status !== "active" ? <span className="text-slate-500">· {recSummary.status}</span> : null}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {recSummary.status === "active"
                        ? <button type="button" disabled={busy} onClick={() => void recAct(q.recurrence_id!, "pause")} className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10.5px] text-amber-700">Pause series</button>
                        : recSummary.status === "paused"
                          ? <button type="button" disabled={busy} onClick={() => void recAct(q.recurrence_id!, "resume")} className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10.5px] text-emerald-700">Resume series</button>
                          : null}
                      {recSummary.status !== "ended" && <button type="button" disabled={busy} onClick={() => void recAct(q.recurrence_id!, "end")} className="rounded-md border border-rose-200 px-2.5 py-1 text-[10.5px] text-rose-600">End series</button>}
                    </div>
                    {recSummary.status !== "ended" && recSummary.accountIds && accounts.length > 1 ? (
                      <div className="mt-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10.5px] text-slate-500">Posts to</span>
                          {accounts.map((a) => {
                            const on = recSummary.accountIds!.includes(a.id);
                            return <button key={a.id} type="button" disabled={busy} aria-pressed={on}
                              onClick={() => void setSeriesAccounts(q.recurrence_id!, on ? recSummary.accountIds!.filter((x) => x !== a.id) : [...recSummary.accountIds!, a.id])}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}><i className={`ti ti-brand-${a.platform}`} aria-hidden="true" />{accountName(a)}</button>;
                          })}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">Every future post in the series goes to each ticked account. Posts already published stay as they are.</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!q.recurrence_id && q.post_id ? (
                  <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50/50 px-2.5 py-2">
                    <button type="button" onClick={() => { setMrOpen((v) => !v); setMrPreview(null); }} className="flex w-full items-center gap-2 text-left">
                      <span className="text-[11.5px] font-semibold text-teal-700"><i className="ti ti-repeat" aria-hidden="true" /> Make recurring</span>
                      <span className={`ml-auto relative inline-flex h-4 w-8 items-center rounded-full ${mrOpen ? "bg-teal-600" : "bg-slate-300"}`}><span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${mrOpen ? "translate-x-4" : "translate-x-0.5"}`} /></span>
                    </button>
                    {mrOpen ? (
                      <div className="mt-2">
                        <div className="text-[10px] text-slate-500">Reuse this post&rsquo;s copy &amp; link on a repeating schedule.</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-[10.5px] text-slate-500">Every</span>
                          <input value={mrInterval} onChange={(e) => { setMrInterval(e.target.value.replace(/[^0-9]/g, "")); setMrPreview(null); }} className="w-11 rounded-md border border-slate-200 px-2 py-0.5 text-[11.5px]" />
                          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-[10.5px]">
                            {(["daily", "weekly", "monthly"] as const).map((f) => (
                              <button key={f} type="button" onClick={() => { setMrFreq(f); setMrPreview(null); }} className={`px-2 py-0.5 ${mrFreq === f ? "bg-teal-600 text-white" : "border-l border-slate-200 text-slate-600 first:border-l-0"}`}>{f === "daily" ? "Day" : f === "weekly" ? "Week" : "Month"}</button>
                            ))}
                          </div>
                        </div>
                        {mrFreq === "weekly" ? (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="mr-1 text-[10px] text-slate-400">On</span>
                            {MR_WEEKDAYS.map((w, i) => {
                              const on = mrWeekdays.includes(w.d);
                              return <button key={i} type="button" onClick={() => { setMrWeekdays((p) => on ? p.filter((x) => x !== w.d) : [...p, w.d]); setMrPreview(null); }} className={`h-5 w-5 rounded-full text-[10px] ${on ? "bg-teal-600 text-white" : "border border-slate-200 text-slate-600"}`}>{w.l}</button>;
                            })}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10.5px] text-slate-500">Ends</span>
                          {([["never", "Never"], ["on_date", "On date"], ["after", "After N"]] as const).map(([v, lbl]) => (
                            <button key={v} type="button" onClick={() => { setMrEndType(v); setMrPreview(null); }} className={`rounded-full px-2 py-0.5 text-[10.5px] ${mrEndType === v ? "border-[1.5px] border-teal-400 text-teal-700" : "border border-slate-200 text-slate-600"}`}>{lbl}</button>
                          ))}
                          {mrEndType === "on_date" && <input type="date" value={mrEndDate} onChange={(e) => { setMrEndDate(e.target.value); setMrPreview(null); }} className="rounded-md border border-slate-200 px-2 py-0.5 text-[11.5px]" />}
                          {mrEndType === "after" && <input value={mrEndCount} onChange={(e) => { setMrEndCount(e.target.value.replace(/[^0-9]/g, "")); setMrPreview(null); }} className="w-11 rounded-md border border-slate-200 px-2 py-0.5 text-[11.5px]" />}
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <button type="button" onClick={() => void mrPreviewFor(q)} className="rounded-md border border-slate-300 px-2 py-1 text-[10.5px] text-teal-600">Preview</button>
                          {mrPreview ? <span className="text-[10.5px] text-slate-500">{mrPreview.upcoming.slice(0, 3).map((ms) => new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" })).join(" · ")}{mrPreview.total ? ` … ${mrPreview.total} total` : ""}</span> : null}
                          <button type="button" disabled={busy} onClick={() => void startSeries(q)} className="ml-auto rounded-md bg-teal-600 px-3 py-1 text-[10.5px] font-medium text-white disabled:opacity-50">Start series</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {/* Stranded mid-publish: the claim happens before the platform call, so we
                  genuinely don't know whether it went out. Say so, and make the human
                  check rather than silently retrying into a possible double-post. */}
              {q.status === "interrupted" ? (
                <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5">
                  <div className="text-[11.5px] font-semibold text-rose-800">⚠ Publishing was interrupted</div>
                  <p className="mt-0.5 text-[11px] text-rose-700">
                    This post may or may not have reached {q.platform ?? "the platform"}. Check there first — then requeue it, or mark it published if it did go out.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <DetailBtn icon="ti-refresh" label="Requeue" onClick={() => act(q.id, "requeue")} accent />
                    <DetailBtn icon="ti-check" label="Mark as published" onClick={() => act(q.id, "mark_published")} />
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                <DetailBtn icon="ti-eye" label="Preview" onClick={() => setPreview(q)} accent />
                {!live ? <DetailBtn icon="ti-edit" label="Edit" onClick={() => { setEditing(true); setDraft(q.body); setEditTime(localHHMM(iso)); }} /> : null}
                {onCal && !live ? <DetailBtn icon="ti-calendar" label="Reschedule" onClick={() => openSchedule(q)} /> : null}
                {!onCal ? <DetailBtn icon="ti-calendar-plus" label="Schedule" onClick={() => openSchedule(q)} /> : null}
                {onCal && !live ? <DetailBtn icon="ti-calendar-off" label="Unschedule" onClick={() => act(q.id, "unschedule")} /> : null}
                <DetailBtn icon="ti-archive" label="Archive" onClick={() => act(q.id, "archive")} />
                {q.recurrence_id
                  ? <DetailBtn icon="ti-trash" label="Delete" onClick={() => { setRecDeleteScope("this"); setRecDelete(q); }} danger />
                  : (!live ? <DetailBtn icon="ti-trash" label="Delete" onClick={() => del(q.id)} danger /> : null)}
                {q.url ? <a href={q.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11.5px] text-blue-600"><i className="ti ti-external-link" aria-hidden="true" /> View</a> : null}
              </div>
            </div>
            {q.post_id && accounts.length > 1 ? (() => {
              const siblings = queue.filter((x) => x.post_id === q.post_id);
              const net = (p: string) => (p === "linkedin" ? "LinkedIn" : p === "facebook" ? "Facebook" : p === "instagram" ? "Instagram" : p === "reddit" ? "Reddit" : p);
              return (
                <div className="mt-3 rounded-lg border border-slate-200">
                  <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Posted to</p>
                  {accounts.map((a) => {
                    const v = siblings.find((x) => x.account_id === a.id) ?? null;
                    const vm = v ? statusMeta(v.status) : null;
                    const when = v?.published_at ? ` ${new Date(v.published_at).toLocaleString([], { hour: "2-digit", minute: "2-digit" })}` : "";
                    return (
                      <div key={a.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 first-of-type:border-t-0">
                        <i className={`ti ti-brand-${a.platform} text-[15px] text-slate-500`} aria-hidden="true" />
                        <span className="min-w-0 flex-1 text-[12px] text-slate-800 md:truncate">{accountName(a)} <span className="text-slate-400">· {net(a.platform)}</span></span>
                        {v && vm ? <span className={`rounded px-2 py-0.5 text-[10.5px] ${vm.cls}`}>{vm.label}{v.status === "published" ? when : ""}</span> : <span className="rounded bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-500">Not in this post</span>}
                        {v?.url
                          ? <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-blue-600 hover:underline">View on {net(a.platform)} <i className="ti ti-external-link" aria-hidden="true" /></a>
                          : !v ? <button type="button" disabled={busy} onClick={() => void addAccount(q.post_id!, a.id)} className="text-[11.5px] text-teal-700 hover:underline disabled:opacity-50">Post here too</button> : null}
                      </div>
                    );
                  })}
                </div>
              );
            })() : null}
            {acctMsg ? <p className="mt-2 text-[11.5px] text-slate-600">{acctMsg}</p> : null}
            {editing ? (
              <div className="mt-3">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} className="w-full rounded-lg border border-slate-200 p-2 text-[13px]" />
                {q.recurrence_id && iso ? (
                  <label className="mt-1.5 flex items-center gap-2 text-[11.5px] text-slate-500">
                    <i className="ti ti-clock" aria-hidden="true" /> Time
                    <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-700" />
                    <span className="text-[10.5px] text-slate-400">You choose which posts in the series to change when you save.</span>
                  </label>
                ) : null}
                <div className="mt-1.5 flex gap-2">
                  <button type="button" onClick={() => saveEdit(q)} disabled={busy} className="rounded-md bg-teal-600 px-3 py-1 text-[11.5px] font-medium text-white">Save</button>
                  <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-slate-200 px-3 py-1 text-[11.5px] text-slate-600">Cancel</button>
                </div>
              </div>
            ) : <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-600">{q.body}</p>}
          </div>
          </div>
        );
      })() : <p className="mt-4 text-center text-[11.5px] text-slate-400">Click a post on the calendar or the rail to see where it posts, edit, reschedule, or preview it.</p>}

      {/* status legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-slate-500">
        {[["Draft", "#64748B"], ["Parked", "#CA8A04"], ["Scheduled", "#16A34A"], ["Published", "#2563EB"], ["Interrupted", "#EA580C"], ["Failed", "#E11D48"]].map(([l, c]) => (
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

      {recDelete ? (
        <div onClick={() => setRecDelete(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[320px] rounded-xl bg-white p-4 shadow-xl">
            <p className="text-[14px] font-semibold text-slate-800">Delete recurring post</p>
            <div className="mt-3 flex flex-col gap-0.5">
              {([["this", "This post"], ["following", "This and following posts"], ["all", "All posts"]] as const).map(([v, lbl]) => (
                <label key={v} className="flex items-center gap-2.5 py-1.5 text-[13px] text-slate-700">
                  <input type="radio" name="recdel" checked={recDeleteScope === v} onChange={() => setRecDeleteScope(v)} /> {lbl}
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setRecDelete(null)} className="text-[12.5px] font-medium text-teal-600">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void deleteRecurring(recDelete, recDeleteScope)} className="rounded-full bg-teal-600 px-5 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50">OK</button>
            </div>
          </div>
        </div>
      ) : null}

      {recEdit ? (
        <div onClick={() => setRecEdit(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[320px] rounded-xl bg-white p-4 shadow-xl">
            <p className="text-[14px] font-semibold text-slate-800">Edit recurring post</p>
            {(() => { const c = recEditChanges(recEdit); const parts = [c.body ? "new text" : null, c.deltaMin ? `time to ${editTime}` : null].filter(Boolean); return <p className="mt-0.5 text-[11px] text-slate-400">Applying: {parts.join(" and ")}</p>; })()}
            <div className="mt-3 flex flex-col gap-0.5">
              {([["this", "This post"], ["following", "This and following posts"], ["all", "All posts"]] as const).map(([v, lbl]) => (
                <label key={v} className="flex items-center gap-2.5 py-1.5 text-[13px] text-slate-700">
                  <input type="radio" name="recedit" checked={recEditScope === v} onChange={() => setRecEditScope(v)} /> {lbl}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[10.5px] text-slate-400">Posts already published stay as they are. Future posts in the series use the new version unless you pick This post.</p>
            <div className="mt-3 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setRecEdit(null)} className="text-[12.5px] font-medium text-teal-600">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void editRecurring(recEdit, recEditScope)} className="rounded-full bg-teal-600 px-5 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50">OK</button>
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
            <button type="button" onClick={() => patch({ removeSlotId: s.id })} className="text-slate-400 hover:text-rose-600"><i className="ti ti-x" aria-hidden="true" /></button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1">
          <select value={wd} onChange={(e) => setWd(Number(e.target.value))} className="bg-transparent text-[13px]">{WD.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-transparent text-[13px]" />
          <button type="button" onClick={() => patch({ addSlot: { weekday: wd, time_local: time } })} className="text-indigo-600"><i className="ti ti-plus" aria-hidden="true" /></button>
        </span>
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">Rotation: {settings.rotation.map((r) => r.replace(/_/g, " ")).join(" → ")}. Slots suggest posting times on the Schedule calendar.</p>

      <p className="mt-5 text-[13px] font-medium text-slate-700">Rules</p>
      <div className="mt-2 flex flex-col gap-2">
        {TOGGLES.map(([key, label]) => (
          <button type="button" key={key} onClick={() => toggle(key)} className={`${card} flex items-center justify-between px-3 py-2.5 text-left text-[13px] text-slate-700`}>
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


function Attribution({ data }: { data: WeekBar[] }) {
  const max = Math.max(1, ...data.map((d) => d.linkedin + d.email + d.website + (d.reddit ?? 0) + d.other));
  const legend: [string, string][] = [["LinkedIn", "#4338CA"], ["Email", "#185FA5"], ["Website", "#F59E0B"], ["Reddit", "#E2583E"], ["Other", "#CBD5E1"]];
  return (
    <div className="max-w-2xl">
      <p className="text-[13px] font-medium text-slate-700">Leads captured by source · 8 weeks</p>
      <div className="mt-4 flex items-end gap-2" style={{ height: 180 }}>
        {data.map((d) => (
          <div key={d.week} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-col-reverse overflow-hidden rounded" style={{ height: 150 }}>
              <div style={{ height: `${(d.linkedin / max) * 150}px`, background: "#4338CA" }} />
              <div style={{ height: `${(d.email / max) * 150}px`, background: "#185FA5" }} />
              <div style={{ height: `${(d.website / max) * 150}px`, background: "#F59E0B" }} />
              <div style={{ height: `${((d.reddit ?? 0) / max) * 150}px`, background: "#E2583E" }} />
              <div style={{ height: `${(d.other / max) * 150}px`, background: "#CBD5E1" }} />
            </div>
            <span className="text-[10px] text-slate-400">{d.week}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4">
        {legend.map(([label, color]) => <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{label}</span>)}
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400">Sourced from funnel leads by attribution tag (li-/em-/web-/rd_). Posts rank by in-range founders, never impressions.</p>
    </div>
  );
}
