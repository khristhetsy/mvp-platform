"use client";

import { useCallback, useEffect, useState } from "react";
import type { SocialUsage } from "@/lib/social/usage";
import type { CampaignFunnel } from "@/components/admin/social/funnel-types";
import { FOUNDER_SOCIAL_DISCLAIMER } from "@/lib/social/templates";
import { FounderSocialGuide } from "@/components/founder/social/FounderSocialGuide";
import { SeriesList } from "@/components/founder/social/FounderSocialExtras";
import { ConnectWizard, type ConnectResult } from "@/components/founder/social/ConnectWizard";
import { CampaignWizard } from "@/components/founder/social/CampaignWizard";
import { PostWizard } from "@/components/founder/social/PostWizard";
import { ReviewWizard, REVIEWED_KEY } from "@/components/founder/social/ReviewWizard";
import { PostView } from "@/components/founder/social/PostView";
import { GUIDE_KEY, PLATFORM_LABEL, api, btn, btnPrimary, card, pt, type Account, type Campaign, type Post } from "@/components/founder/social/FounderSocialShared";
import { postState, screenForTab, setupProgress, type LaunchScreen } from "@/lib/social/launch";

type Screen = LaunchScreen | "view";

/**
 * Launch my social media. A home screen with the four steps and your posts, and four short
 * wizards (Connect, Campaign, New post, Weekly review). Same API routes and rules as the old tabs.
 */
export function FounderSocialClient({ initialUsage, companyName, founderName, initialDraft, initialTab, acting, connectResult = null }: {
  initialUsage: SocialUsage; companyName: string | null; founderName: string; initialDraft: string; initialTab: string | null; acting: boolean; connectResult?: ConnectResult;
}) {
  const [screen, setScreen] = useState<Screen>(connectResult ? "connect" : screenForTab(initialTab));
  const [usage, setUsage] = useState<SocialUsage>(initialUsage);
  const [accounts, setAccounts] = useState<Account[]>([]);
  // Only true once the account list has loaded, so the not connected note never flashes or shows on a failed load.
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [funnels, setFunnels] = useState<CampaignFunnel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [intros, setIntros] = useState(0);
  const [introsOther, setIntrosOther] = useState(0);
  const [introsByTag, setIntrosByTag] = useState<Record<string, number>>({});
  const [guideOpen, setGuideOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [defaultCampaignId, setDefaultCampaignId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [u, a, c, l] = await Promise.all([
      api<{ usage: SocialUsage }>("/api/founder/social/usage"),
      api<{ accounts: Account[] }>("/api/founder/social/accounts"),
      api<{ campaigns: Campaign[]; funnels: CampaignFunnel[]; intros?: number; introsOther?: number; introsByTag?: Record<string, number> }>("/api/founder/social/campaigns"),
      api<{ posts: Post[] }>("/api/founder/social/library"),
    ]);
    if (u.ok && u.data.usage) setUsage(u.data.usage);
    if (a.ok) { setAccounts(a.data.accounts ?? []); setAccountsLoaded(true); }
    if (c.ok) { setCampaigns(c.data.campaigns ?? []); setFunnels(c.data.funnels ?? []); setIntros(c.data.intros ?? 0); setIntrosOther(c.data.introsOther ?? 0); setIntrosByTag(c.data.introsByTag ?? {}); }
    if (l.ok) setPosts(l.data.posts ?? []);
  }, []);
  const noAccounts = accountsLoaded && accounts.length === 0;

  // Deferred a tick so state is never set synchronously inside the effect.
  useEffect(() => { const t = setTimeout(() => void reload(), 0); return () => clearTimeout(t); }, [reload]);
  // The guide opens once on the first visit, then only from the How to use button.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (!localStorage.getItem(GUIDE_KEY)) { setGuideOpen(true); localStorage.setItem(GUIDE_KEY, "1"); }
        setReviewed(Boolean(localStorage.getItem(REVIEWED_KEY)));
      } catch { /* storage unavailable */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const home = () => { setSeed(null); setScreen("home"); void reload(); };
  const progress = setupProgress({ accounts, campaigns: campaigns.length, posts, reviewed });
  const viewPost = posts.find((p) => p.id === viewId) ?? null;
  const open = (s: LaunchScreen) => setScreen(s);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Launch my social media</h1>
        <button type="button" className={`${btn} ml-auto`} onClick={() => setGuideOpen(true)}>? How to use</button>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">Four short steps. Connect an account, create a campaign, write a post, then review your results each week. All times are Pacific (PT).</p>

      <div className="mt-4">
        {screen === "home" && (
          <Home progress={progress} usage={usage} accounts={accounts} posts={posts} campaignsCount={campaigns.length} noAccounts={noAccounts} acting={acting}
            onOpen={open} onView={(id) => { setViewId(id); setScreen("view"); }} onChange={reload} onWriteLike={(body) => { setSeed(body); setScreen("post"); }} />
        )}
        {screen === "connect" && <ConnectWizard accounts={accounts} acting={acting} result={connectResult} onExit={home} onNext={() => { void reload(); setScreen("campaign"); }} />}
        {screen === "campaign" && <CampaignWizard onChanged={reload} onExit={home} onNext={(c) => { setDefaultCampaignId(c?.id ?? null); setScreen("post"); }} />}
        {screen === "post" && (
          <PostWizard usage={usage} accounts={accounts} campaigns={campaigns} companyName={companyName} founderName={founderName} initialDraft={initialDraft} seed={seed} defaultCampaignId={defaultCampaignId}
            noAccounts={noAccounts} acting={acting} onSaved={reload} onConnect={() => setScreen("connect")} onExit={home} onView={(id) => { setViewId(id); setScreen("view"); }} />
        )}
        {screen === "review" && (
          <ReviewWizard funnels={funnels} campaigns={campaigns} intros={intros} introsOther={introsOther} introsByTag={introsByTag} onExit={() => { setReviewed(true); home(); }} onWrite={() => { setReviewed(true); setScreen("post"); }} />
        )}
        {screen === "view" && (viewPost ? <PostView post={viewPost} onBack={home} onChanged={reload} /> : (
          <div className={card}><p className="text-sm text-slate-600">This post is not in your list any more.</p><button type="button" className={`${btn} mt-3`} onClick={home}>Back to home</button></div>
        ))}
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-slate-400">{FOUNDER_SOCIAL_DISCLAIMER}</p>
      {guideOpen && <FounderSocialGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

const TILES: { key: LaunchScreen; title: string; body: string; label: string }[] = [
  { key: "connect", title: "Connect an account", body: "LinkedIn, Facebook, Instagram or Reddit", label: "Connect" },
  { key: "campaign", title: "Create a campaign", body: "Group posts, set goals and alerts", label: "Create" },
  { key: "post", title: "Write a post", body: "Draft, pick networks, schedule", label: "Write" },
  { key: "review", title: "Weekly review", body: "Funnel, weakest step, next post", label: "Review" },
];

function Home({ progress, usage, accounts, posts, campaignsCount, noAccounts, acting, onOpen, onView, onChange, onWriteLike }: {
  progress: ReturnType<typeof setupProgress>; usage: SocialUsage; accounts: Account[]; posts: Post[]; campaignsCount: number; noAccounts: boolean; acting: boolean;
  onOpen: (s: LaunchScreen) => void; onView: (id: string) => void; onChange: () => Promise<void>; onWriteLike: (body: string) => void;
}) {
  const plan = usage.planType ? usage.planType.replace("founder_", "").replace(/^./, (c) => c.toUpperCase()) : "Your";
  const nextKey = progress.steps.find((s) => !s.done)?.key ?? null;
  const pct = Math.round((progress.doneCount / progress.steps.length) * 100);

  async function act(postId: string, action: "archive" | "unarchive" | "delete") {
    await api("/api/founder/social/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, action }) });
    await onChange();
  }
  async function disconnect(id: string) {
    await api("/api/founder/social/accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await onChange();
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Your launch</h2>
          <span className="text-xs text-slate-500">{progress.doneCount} of {progress.steps.length} steps done</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100" aria-hidden="true"><div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map((t) => {
            const done = progress.steps.find((s) => s.key === t.key)?.done ?? false;
            const blocked = t.key === "post" && noAccounts;
            return (
              <div key={t.key} className={`rounded-xl border p-3 ${nextKey === t.key ? "border-2 border-[#1A6CE4] bg-blue-50" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{t.title}</span>
                  {done && <span className="text-xs font-medium text-emerald-700">Done</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.body}</p>
                <button type="button" className={`${nextKey === t.key ? btnPrimary : btn} mt-3`} disabled={blocked} onClick={() => onOpen(t.key)}>{done ? "Open again" : t.label}</button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-slate-700">{plan} plan: <b>{usage.used}</b> of <b>{usage.limit ?? "unlimited"}</b> posts used. Resets {pt(usage.resetAt, false)}, 12:00 AM PT.</p>
        {campaignsCount === 0 && <p className="mt-1 text-xs text-slate-500">No campaigns yet. A campaign lets your results roll up to one goal.</p>}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Your posts</h2>
          <button type="button" className={btnPrimary} disabled={noAccounts} onClick={() => onOpen("post")}>+ New post</button>
        </div>
        {posts.length === 0 ? <p className="mt-2 text-sm text-slate-600">Your posts will appear here.</p> : posts.slice(0, 20).map((p) => {
          const st = postState(p);
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0">
              <div className="min-w-0">
                <div className="truncate text-sm text-slate-900">{p.title?.trim() || p.body.split("\n")[0]}</div>
                <div className="text-xs text-slate-500">{st.label} · {pt(p.scheduled_at ?? p.created_at, false)}</div>
              </div>
              <span className="flex shrink-0 gap-3">
                <button type="button" className="text-xs font-medium text-[#1A6CE4] hover:underline" onClick={() => onView(p.id)}>View post</button>
                <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => onWriteLike(p.body)}>Write another like this</button>
                <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => void act(p.id, p.archived_at ? "unarchive" : "archive")}>{p.archived_at ? "Restore" : "Archive"}</button>
              </span>
            </div>
          );
        })}
      </div>

      <SeriesList />

      <div className={card}>
        <h2 className="text-base font-semibold text-slate-900">Connected accounts</h2>
        {accounts.length === 0 ? <p className="mt-2 text-sm text-slate-600">No accounts connected yet.</p> : accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between border-t border-slate-100 py-2 first:border-t-0">
            <span className="text-sm text-slate-900">{PLATFORM_LABEL[a.platform] ?? a.platform}{a.displayName ? `, ${a.displayName}` : ""}</span>
            <span className="flex items-center gap-3">
              <span className={`text-xs ${a.status === "connected" ? "text-emerald-700" : "text-amber-700"}`}>{a.status === "connected" ? "Connected" : a.status === "expiring" ? "Expiring soon" : "Reconnect needed"}</span>
              {!acting && <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => void disconnect(a.id)}>Disconnect</button>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
