"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SocialUsage } from "@/lib/social/usage";
import type { CampaignFunnel, StageKey } from "@/components/admin/social/funnel-types";
import { fmt } from "@/components/admin/social/funnel-types";
import { FOUNDER_SOCIAL_DISCLAIMER, TEMPLATE_KEYS, TEMPLATE_LABELS, type TemplateKey } from "@/lib/social/templates";
import { FounderSocialGuide } from "@/components/founder/social/FounderSocialGuide";

type Tab = "overview" | "campaigns" | "compose" | "schedule" | "library" | "attribution" | "settings";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "campaigns", label: "Campaigns and goals" },
  { key: "compose", label: "Compose" },
  { key: "schedule", label: "Schedule" },
  { key: "library", label: "Library" },
  { key: "attribution", label: "Attribution" },
  { key: "settings", label: "Settings" },
];

type Account = { id: string; platform: string; displayName: string | null; status: string };
type Campaign = { id: string; name: string; source_tag: string };
type Post = {
  id: string; title: string | null; body: string; status: string; scheduled_at: string | null; held_until: string | null; archived_at: string | null; created_at: string;
  campaign: { name: string } | null; variants: { status: string; account: { platform: string } | null }[];
};

const PLATFORM_LABEL: Record<string, string> = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", reddit: "Reddit" };
const GUIDE_KEY = "icapos_founder_social_guide_seen";

const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const btnPrimary = "rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2E78F5] disabled:opacity-50";
const card = "rounded-xl border border-slate-200 bg-white p-4";

/** "Oct 22, 12:00 AM PT" style label for any stored instant. */
function pt(iso: string | null, withTime = true): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })} PT`;
}

/** A datetime-local value typed as Pacific time, to a UTC ISO string. */
function ptLocalToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  for (const off of [7, 8]) {
    const cand = new Date(Date.UTC(y, mo - 1, d, h + off, mi));
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(cand);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    if (g("year") === y && g("month") === mo && g("day") === d && g("hour") === h && g("minute") === mi) return cand.toISOString();
  }
  return null;
}

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string; code?: string } }> {
  try {
    const res = await fetch(url, init);
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error." } as T & { error?: string } };
  }
}

export function FounderSocialClient({ initialUsage, companyName, initialTab }: { initialUsage: SocialUsage; companyName: string | null; initialTab: string | null }) {
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === initialTab) ? (initialTab as Tab) : "overview");
  const [usage, setUsage] = useState<SocialUsage>(initialUsage);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [funnels, setFunnels] = useState<CampaignFunnel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);

  const reload = useCallback(async () => {
    const [u, a, c, l] = await Promise.all([
      api<{ usage: SocialUsage }>("/api/founder/social/usage"),
      api<{ accounts: Account[] }>("/api/founder/social/accounts"),
      api<{ campaigns: Campaign[]; funnels: CampaignFunnel[] }>("/api/founder/social/campaigns"),
      api<{ posts: Post[] }>("/api/founder/social/library"),
    ]);
    if (u.ok && u.data.usage) setUsage(u.data.usage);
    if (a.ok) setAccounts(a.data.accounts ?? []);
    if (c.ok) { setCampaigns(c.data.campaigns ?? []); setFunnels(c.data.funnels ?? []); }
    if (l.ok) setPosts(l.data.posts ?? []);
  }, []);

  // Deferred a tick so state is never set synchronously inside the effect.
  useEffect(() => { const t = setTimeout(() => void reload(), 0); return () => clearTimeout(t); }, [reload]);
  // The guide opens once on the first visit, then only from the How to use button.
  useEffect(() => {
    const t = setTimeout(() => {
      try { if (!localStorage.getItem(GUIDE_KEY)) { setGuideOpen(true); localStorage.setItem(GUIDE_KEY, "1"); } } catch { /* storage unavailable */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} onClick={() => setTab("compose")}>+ New post</button>
        <h1 className="text-2xl font-semibold text-slate-900">Social media</h1>
        <button type="button" className={`${btn} ml-auto`} onClick={() => setGuideOpen(true)}>? How to use</button>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Compose, schedule and publish to your own connected accounts. The queue runs every 5 minutes, and your tracked link posts as the first comment. All times are Pacific (PT).
      </p>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? "border-[#1A6CE4] font-medium text-[#1A6CE4]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "overview" && <Overview usage={usage} funnels={funnels} />}
        {tab === "campaigns" && <Campaigns campaigns={campaigns} funnels={funnels} onChange={reload} />}
        {tab === "compose" && <Compose usage={usage} accounts={accounts} campaigns={campaigns} companyName={companyName} onSaved={reload} goSettings={() => setTab("settings")} />}
        {tab === "schedule" && <Schedule posts={posts} />}
        {tab === "library" && <Library posts={posts} onChange={reload} />}
        {tab === "attribution" && <Attribution funnels={funnels} />}
        {tab === "settings" && <Settings accounts={accounts} onChange={reload} />}
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-slate-400">{FOUNDER_SOCIAL_DISCLAIMER}</p>
      {guideOpen && <FounderSocialGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

// ───────────────────────────── Overview ─────────────────────────────

type Ring = { label: string; actual: number; target: number | null };

function sumStage(funnels: CampaignFunnel[], key: StageKey): { actual: number; target: number | null } {
  let actual = 0; let target: number | null = null;
  for (const f of funnels) {
    const s = f.stages.find((x) => x.stage === key);
    if (!s) continue;
    actual += s.actual;
    if (s.target != null) target = (target ?? 0) + s.target;
  }
  return { actual, target };
}

function Overview({ usage, funnels }: { usage: SocialUsage; funnels: CampaignFunnel[] }) {
  const [tip, setTip] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void api<{ tip: string }>("/api/founder/social/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "next" }) })
      .then((r) => { if (live && r.ok) setTip(r.data.tip ?? null); });
    return () => { live = false; };
  }, [funnels.length]);

  const outreach = sumStage(funnels, "outreach");
  const rings: Ring[] = [
    { label: "Outreach", ...outreach },
    // Estimated, the same way as the iCFO view: published posts times 300.
    { label: "Impressions (est.)", actual: outreach.actual * 300, target: outreach.target != null ? outreach.target * 300 : null },
    { label: "Clicks", ...sumStage(funnels, "clicks") },
    { label: "Meetings", ...sumStage(funnels, "meetings") },
    { label: "Investor intros", ...sumStage(funnels, "conversions") },
  ];

  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-base font-semibold text-slate-900">Command center, this month</h2>
        {funnels.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No campaigns yet. Create one in Campaigns and goals, then post to see your funnel here.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {rings.map((r) => {
              const pct = r.target ? Math.min(100, Math.round((r.actual / r.target) * 100)) : null;
              return (
                <div key={r.label} className="text-center">
                  <div className="text-2xl font-semibold text-slate-900">{fmt(r.actual)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">{r.label}</div>
                  <div className="mx-auto mt-2 h-1.5 w-full max-w-[110px] rounded-full bg-slate-100" aria-hidden>
                    <div className="h-1.5 rounded-full bg-[#1A6CE4]" style={{ width: `${pct ?? 0}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{r.target ? `${pct}% of ${fmt(r.target)}` : "No goal set"}</div>
                </div>
              );
            })}
          </div>
        )}
        {tip && (
          <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
            <span className="font-semibold">AI agent. </span>{tip}
          </div>
        )}
      </div>
      <div className={card}>
        <h2 className="text-base font-semibold text-slate-900">Posting this cycle</h2>
        <UsageLine usage={usage} />
      </div>
    </div>
  );
}

function UsageLine({ usage }: { usage: SocialUsage }) {
  const plan = usage.planType ? usage.planType.replace("founder_", "").replace(/^./, (c) => c.toUpperCase()) : "Your";
  return (
    <p className="mt-2 text-sm text-slate-700">
      {plan} plan: <b>{usage.used}</b> of <b>{usage.limit ?? "unlimited"}</b> posts used. Resets {pt(usage.resetAt, false)}, 12:00 AM PT.
    </p>
  );
}

// ───────────────────────────── Campaigns ─────────────────────────────

function Campaigns({ campaigns, funnels, onChange }: { campaigns: Campaign[]; funnels: CampaignFunnel[]; onChange: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    const r = await api<{ campaign: Campaign }>("/api/founder/social/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error ?? "Could not create campaign."); return; }
    setName(""); await onChange();
  }
  async function archive(id: string) {
    await api("/api/founder/social/campaigns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, archived: true }) });
    await onChange();
  }
  const byId = new Map(funnels.map((f) => [f.campaignId, f]));

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold text-slate-900">Campaigns</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" maxLength={80} className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        <button type="button" className={btnPrimary} disabled={busy || !name.trim()} onClick={() => void create()}>+ New campaign</button>
      </div>
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
      {campaigns.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">A campaign groups posts toward one goal, such as your seed round. Posts in a campaign carry its tracking tag.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-2 font-medium">Campaign</th><th className="py-2 font-medium">Posts</th><th className="py-2 font-medium">Clicks</th><th className="py-2 font-medium">Meetings</th><th /></tr></thead>
          <tbody>
            {campaigns.map((c) => {
              const f = byId.get(c.id);
              const s = (k: StageKey) => f?.stages.find((x) => x.stage === k);
              const cell = (k: StageKey) => { const x = s(k); return x ? `${x.actual}${x.target != null ? ` / ${x.target}` : ""}` : "0"; };
              return (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="py-2 text-slate-900">{c.name}</td>
                  <td className="py-2 text-slate-600">{cell("outreach")}</td>
                  <td className="py-2 text-slate-600">{cell("clicks")}</td>
                  <td className="py-2 text-slate-600">{cell("meetings")}</td>
                  <td className="py-2 text-right"><button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => void archive(c.id)}>Archive</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-slate-500">Goals per stage and the goal planner are not enabled for founders yet.</p>
    </div>
  );
}

// ───────────────────────────── Compose ─────────────────────────────

function Compose({ usage, accounts, campaigns, companyName, onSaved, goSettings }: {
  usage: SocialUsage; accounts: Account[]; campaigns: Campaign[]; companyName: string | null; onSaved: () => Promise<void>; goSettings: () => void;
}) {
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dialog, setDialog] = useState(false);
  // A fresher usage from a rejected save wins only until the parent sends a new usage.
  const [override, setOverride] = useState<{ base: SocialUsage; value: SocialUsage } | null>(null);
  const local = override && override.base === usage ? override.value : usage;
  const setLocal = (value: SocialUsage) => setOverride({ base: usage, value });

  const reached = local.state === "reached";
  const chosen = accounts.filter((a) => picked.includes(a.id));

  async function agent(payload: Record<string, unknown>): Promise<{ text?: string; variants?: Record<string, string> } | null> {
    const r = await api<{ text?: string; variants?: Record<string, string> }>("/api/founder/social/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "The AI agent could not run." }); return null; }
    return r.data;
  }
  async function template(key: TemplateKey) {
    const out = await agent({ action: "template", template: key, notes: body, company: companyName });
    if (out?.text) { setBody(out.text); setMsg(null); }
  }
  async function transform(action: "shorten" | "hashtags") {
    const out = await agent({ action, text: body, network: chosen[0]?.platform ?? "linkedin" });
    if (out?.text) setBody(out.text);
  }

  async function save(mode: "draft" | "schedule" | "now" | "hold") {
    setMsg(null);
    if (!body.trim()) { setMsg({ ok: false, text: "Write something first." }); return; }
    if (chosen.length === 0) { setMsg({ ok: false, text: "Pick at least one connected account. Connect one in Settings." }); return; }
    let scheduledAt: string | null = null;
    if (mode === "schedule") {
      scheduledAt = ptLocalToIso(when);
      if (!scheduledAt) { setMsg({ ok: false, text: "Pick a date and time (Pacific time)." }); return; }
    }
    setBusy(true);
    // Per network rewrite (never identical copy across accounts), then one post that counts once.
    let variants: { accountId: string; body: string }[] = chosen.map((a) => ({ accountId: a.id, body }));
    if (chosen.length > 1) {
      const out = await agent({ action: "variants", text: body, networks: [...new Set(chosen.map((a) => a.platform))] });
      if (out?.variants) variants = chosen.map((a) => ({ accountId: a.id, body: out.variants?.[a.platform] ?? body }));
    }
    const r = await api<{ usage?: SocialUsage }>("/api/founder/social/posts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, scheduledAt, campaignId: campaignId || null, linkUrl: linkUrl || null, variants }),
    });
    setBusy(false);
    if (r.status === 403 && r.data.code === "limit_reached") { if (r.data.usage) setLocal(r.data.usage); setDialog(true); return; }
    if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "Could not save." }); return; }
    setMsg({ ok: true, text: mode === "draft" ? "Draft saved." : mode === "hold" ? `Saved. We will remind you on ${pt(local.resetAt, false)}.` : mode === "now" ? "Queued. It publishes within 5 minutes." : "Scheduled." });
    setDialog(false);
    if (mode !== "draft") setBody("");
    await onSaved();
  }

  return (
    <div className="mx-auto max-w-2xl">
      {local.state === "warn" && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {local.remaining} post{local.remaining === 1 ? "" : "s"} left this month. Your limit resets {pt(local.resetAt, false)}.
        </div>
      )}
      {reached && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          You&rsquo;ve used all {local.limit} posts on {local.planType?.replace("founder_", "").replace(/^./, (c) => c.toUpperCase())} this month. Your limit resets {pt(local.resetAt, false)}. Posts you already scheduled will still go out.
        </div>
      )}

      <div className={card}>
        <h2 className="text-base font-semibold text-slate-900">Compose post</h2>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No connected accounts yet. <button type="button" className="font-medium text-[#1A6CE4] hover:underline" onClick={goSettings}>Open Settings</button> to connect one.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {accounts.map((a) => {
              const on = picked.includes(a.id);
              return (
                <button key={a.id} type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                  className={`rounded-full border px-3 py-1 text-sm ${on ? "border-[#1A6CE4] text-[#1A6CE4]" : "border-slate-300 text-slate-600"}`}>
                  {PLATFORM_LABEL[a.platform] ?? a.platform}{a.displayName ? `: ${a.displayName}` : ""}
                </button>
              );
            })}
          </div>
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Write your post, or jot a few notes and pick a template below." className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />

        <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
          <div className="text-sm font-semibold text-violet-800">✦ AI agent</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TEMPLATE_KEYS.map((k) => (
              <button key={k} type="button" className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs text-violet-800 hover:bg-violet-100" onClick={() => void template(k)}>{TEMPLATE_LABELS[k]}</button>
            ))}
            <button type="button" className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs text-violet-800 hover:bg-violet-100" onClick={() => void transform("shorten")}>Shorten</button>
            <button type="button" className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs text-violet-800 hover:bg-violet-100" onClick={() => void transform("hashtags")}>Add hashtags</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Free mode. Templates are filled from your notes, and you review every draft. Drafts never count toward your post limit.</p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-500">Tracked link, posts as the first comment
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900" />
          </label>
          <label className="text-xs text-slate-500">Campaign
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900">
              <option value="">None</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">Date and time (PT)
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`mr-auto text-xs ${reached ? "text-red-700" : "text-slate-500"}`}>
            {local.limit === null ? "Unlimited posts" : reached ? `${local.used} of ${local.limit} used` : `${local.remaining} of ${local.limit} posts left this cycle`}
          </span>
          <button type="button" className={btn} disabled={busy} onClick={() => void save("draft")}>Save draft</button>
          {reached ? (
            <button type="button" className={btnPrimary} onClick={() => setDialog(true)}>Upgrade to schedule</button>
          ) : (
            <>
              <button type="button" className={btn} disabled={busy} onClick={() => void save("now")}>Post now</button>
              <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save("schedule")}>Schedule</button>
            </>
          )}
        </div>
        {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Monthly post limit reached">
          <div className="w-full max-w-sm rounded-xl bg-white p-5">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-slate-900">Monthly post limit reached</h3>
              <button type="button" aria-label="Close" className="text-slate-400 hover:text-slate-700" onClick={() => setDialog(false)}>✕</button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Your plan includes up to {local.limit} posts a month. Upgrade for a higher limit, or wait until your limit resets on {pt(local.resetAt, false)}.
            </p>
            <Link href="/pricing" className="mt-4 block rounded-lg bg-[#1A6CE4] px-3 py-2 text-center text-sm font-medium text-white hover:bg-[#2E78F5]">Upgrade your plan</Link>
            <button type="button" className={`${btn} mt-2 w-full`} disabled={busy} onClick={() => void save("hold")}>Save as draft for {pt(local.resetAt, false)}</button>
            <p className="mt-2 text-xs text-slate-500">Saved drafts never post automatically. We will remind you on {pt(local.resetAt, false)}.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Schedule ─────────────────────────────

function networksOf(p: Post): string {
  return [...new Set(p.variants.map((v) => v.account?.platform).filter((x): x is string => Boolean(x)))].map((x) => PLATFORM_LABEL[x] ?? x).join(", ");
}

function Schedule({ posts }: { posts: Post[] }) {
  const rows = useMemo(() => posts
    .filter((p) => !p.archived_at && (p.status === "scheduled" || p.held_until))
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")), [posts]);
  return (
    <div className={card}>
      <h2 className="text-base font-semibold text-slate-900">Schedule</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Nothing scheduled. Write a post in Compose and pick a date and time.</p>
      ) : rows.map((p) => (
        <div key={p.id} className="flex items-start justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0">
          <div className="min-w-0">
            <div className="truncate text-sm text-slate-900">{p.title?.trim() || p.body.split("\n")[0]}</div>
            <div className="text-xs text-slate-500">{p.scheduled_at ? pt(p.scheduled_at) : "No date"}{networksOf(p) ? ` · ${networksOf(p)}` : ""}</div>
          </div>
          <span className={`shrink-0 text-xs ${p.held_until ? "text-slate-500" : "text-emerald-700"}`}>{p.held_until ? `Draft, waiting for reset ${pt(p.held_until, false)}` : "Scheduled"}</span>
        </div>
      ))}
      <p className="mt-3 text-xs text-slate-500">Drag to reschedule and recurring series are not enabled for founders yet.</p>
    </div>
  );
}

// ───────────────────────────── Library ─────────────────────────────

function Library({ posts, onChange }: { posts: Post[]; onChange: () => Promise<void> }) {
  async function act(postId: string, action: "archive" | "unarchive" | "delete") {
    await api("/api/founder/social/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, action }) });
    await onChange();
  }
  return (
    <div className={card}>
      <h2 className="text-base font-semibold text-slate-900">Library</h2>
      {posts.length === 0 ? <p className="mt-2 text-sm text-slate-600">Your posts will appear here.</p> : posts.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0">
          <div className="min-w-0">
            <div className="truncate text-sm text-slate-900">{p.title?.trim() || p.body.split("\n")[0]}</div>
            <div className="text-xs text-slate-500">{p.held_until ? "Draft, waiting for reset" : p.status}{p.archived_at ? ", archived" : ""} · {pt(p.scheduled_at ?? p.created_at, false)}</div>
          </div>
          <span className="flex shrink-0 gap-2">
            <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => void act(p.id, p.archived_at ? "unarchive" : "archive")}>{p.archived_at ? "Restore" : "Archive"}</button>
            <button type="button" className="text-xs text-red-600 hover:text-red-800" onClick={() => void act(p.id, "delete")}>Delete</button>
          </span>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── Attribution ─────────────────────────────

function Attribution({ funnels }: { funnels: CampaignFunnel[] }) {
  const get = (f: CampaignFunnel, k: StageKey) => f.stages.find((s) => s.stage === k)?.actual ?? 0;
  return (
    <div className={card}>
      <h2 className="text-base font-semibold text-slate-900">Attribution</h2>
      {funnels.length === 0 ? <p className="mt-2 text-sm text-slate-600">Post in a campaign to see which post led to a click and a meeting.</p> : (
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-2 font-medium">Campaign</th><th className="py-2 font-medium">Clicks</th><th className="py-2 font-medium">Meetings</th><th className="py-2 font-medium">Investor intros</th></tr></thead>
          <tbody>{funnels.map((f) => (
            <tr key={f.campaignId} className="border-t border-slate-100"><td className="py-2 text-slate-900">{f.name}</td><td className="py-2">{get(f, "clicks")}</td><td className="py-2">{get(f, "meetings")}</td><td className="py-2">{get(f, "conversions")}</td></tr>
          ))}</tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-slate-500">Impressions are estimated (published posts × 300). Clicks come from your tracked links.</p>
    </div>
  );
}

// ───────────────────────────── Settings ─────────────────────────────

function Settings({ accounts, onChange }: { accounts: Account[]; onChange: () => Promise<void> }) {
  async function disconnect(id: string) {
    await api("/api/founder/social/accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await onChange();
  }
  return (
    <div className={card}>
      <h2 className="text-base font-semibold text-slate-900">Connected accounts</h2>
      {accounts.length === 0 ? <p className="mt-2 text-sm text-slate-600">No accounts connected yet.</p> : accounts.map((a) => (
        <div key={a.id} className="flex items-center justify-between border-t border-slate-100 py-2 first:border-t-0">
          <span className="text-sm text-slate-900">{PLATFORM_LABEL[a.platform] ?? a.platform}{a.displayName ? `, ${a.displayName}` : ""}</span>
          <span className="flex items-center gap-3">
            <span className={`text-xs ${a.status === "connected" ? "text-emerald-700" : "text-amber-700"}`}>{a.status === "connected" ? "Connected" : a.status === "expiring" ? "Expiring soon" : "Reconnect needed"}</span>
            <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => void disconnect(a.id)}>Disconnect</button>
          </span>
        </div>
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        {["LinkedIn", "Facebook", "Instagram", "Reddit"].map((n) => (
          <a key={n} href={`/api/founder/social/connect?platform=${n.toLowerCase()}`} className={btn}>Connect {n}</a>
        ))}
      </div>
    </div>
  );
}
