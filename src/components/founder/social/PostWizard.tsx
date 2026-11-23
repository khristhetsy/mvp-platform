"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SocialUsage } from "@/lib/social/usage";
import { FOUNDER_SOCIAL_DISCLAIMER, NETWORKS, TEMPLATE_KEYS, TEMPLATE_LABELS, type Network, type TemplateKey } from "@/lib/social/templates";
import { SocialPreview } from "@/components/founder/social/SocialPreview";
import { MultiDatePicker } from "@/components/founder/social/MultiDatePicker";
import { DoneCard, WizardFrame } from "@/components/founder/social/LaunchFrame";
import { AGENT_COMMENT, DRAFT_KEY, PLATFORM_LABEL, api, btn, btnPrimary, pt, ptLocalToIso, type Account, type Campaign } from "@/components/founder/social/FounderSocialShared";

const LABELS = ["Topic", "Draft", "Networks", "When", "Review"];
type Topic = "auto" | TemplateKey;
const TOPICS: { key: Topic; title: string; note: string }[] = [
  { key: "auto", title: "My auto draft", note: "Written from your company profile" },
  { key: "milestone", title: "Share a milestone", note: "A pilot, a customer, a launch" },
  { key: "investor_update", title: "Investor update", note: "Progress in a few lines" },
  { key: "hiring", title: "We are hiring", note: "One role, one clear ask" },
  { key: "product_launch", title: "Product launch", note: "What is new and who it is for" },
  { key: "event", title: "Event", note: "Where you will be and why" },
];

function NotConnectedNote({ acting, onConnect }: { acting: boolean; onConnect: () => void }) {
  const t = useTranslations("founderCmp");
  return (
    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900" role="status">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("social_connect_title")}</p>
          <p className="mt-1 text-sm text-amber-800">{t("social_connect_body")}{acting && <> {t("social_connect_founder_only")}</>}</p>
        </div>
        {!acting && <button type="button" className={btnPrimary} onClick={onConnect}>{t("social_connect_accounts")}</button>}
      </div>
    </div>
  );
}

type Outcome = { text: string; postId: string | null };

/** Part 3 of Launch my social media: topic, draft, networks, time, review. Same API routes and rules as before. */
export function PostWizard({ usage, accounts, campaigns, companyName, founderName, initialDraft, seed, defaultCampaignId, noAccounts, acting, onSaved, onConnect, onExit, onView }: {
  usage: SocialUsage; accounts: Account[]; campaigns: Campaign[]; companyName: string | null; founderName: string; initialDraft: string; seed: string | null; defaultCampaignId: string | null;
  noAccounts: boolean; acting: boolean; onSaved: () => Promise<void>; onConnect: () => void; onExit: () => void; onView: (postId: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState<Topic>("auto");
  // A seed (from "Write another like this") wins over the kept draft. Otherwise the kept draft is restored once.
  const [body, setBody] = useState(seed ?? initialDraft);
  const [previewNet, setPreviewNet] = useState<Network | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const aiRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState(defaultCampaignId ?? "");
  const [agentLinks, setAgentLinks] = useState<Record<string, string> | null | undefined>(undefined);
  const [agentOn, setAgentOn] = useState(true);
  const [mode, setMode] = useState<"schedule" | "now">("schedule");
  const [dates, setDates] = useState<string[]>([]);
  const [time, setTime] = useState("08:15");
  const when = dates[0] ? `${dates[0]}T${time || "08:15"}` : "";
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [repeatCount, setRepeatCount] = useState("8");
  const [emailed, setEmailed] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string; firm: string | null; email: string }[]>([]);
  const [chosenInvestors, setChosenInvestors] = useState<string[]>([]);
  const [emailsLeft, setEmailsLeft] = useState<{ remaining: number | null; limit: number | null }>({ remaining: null, limit: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dialog, setDialog] = useState(false);
  const [done, setDone] = useState<Outcome | null>(null);
  const [override, setOverride] = useState<{ base: SocialUsage; value: SocialUsage } | null>(null);
  const local = override && override.base === usage ? override.value : usage;
  const setLocal = (value: SocialUsage) => setOverride({ base: usage, value });
  const reached = local.state === "reached";

  const chosen = accounts.filter((a) => picked.includes(a.id));
  const rawNet = previewNet ?? chosen[0]?.platform ?? "linkedin";
  const shownNet: Network = (NETWORKS as readonly string[]).includes(rawNet) ? (rawNet as Network) : "linkedin";
  const agentUrl = agentLinks ? (agentLinks[chosen[0]?.platform ?? "linkedin"] ?? agentLinks.linkedin ?? null) : null;
  const useAgent = agentOn && Boolean(agentUrl);
  const effectiveLink = useAgent ? (agentUrl as string) : "";
  const effectiveComment = useAgent ? AGENT_COMMENT : null;

  useEffect(() => {
    const t = setTimeout(() => {
      if (seed === null) { try { const kept = localStorage.getItem(DRAFT_KEY); if (kept !== null) setBody(kept); } catch { /* storage unavailable */ } }
      restored.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [seed]);
  useEffect(() => {
    if (!restored.current) return;
    try { if (body) localStorage.setItem(DRAFT_KEY, body); else localStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ }
  }, [body]);
  useEffect(() => {
    let live = true;
    void api<{ agent: { links: Record<string, string> } | null }>("/api/founder/social/agent-link").then((r) => { if (live) setAgentLinks(r.ok ? (r.data.agent?.links ?? null) : null); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!aiOpen) return;
    const close = (e: MouseEvent) => { if (aiRef.current && !aiRef.current.contains(e.target as Node)) setAiOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [aiOpen]);
  // One connected account is picked for the founder so the common case needs no tap.
  useEffect(() => {
    if (accounts.length === 1) { const only = accounts[0].id; const t = setTimeout(() => setPicked((p) => (p.length ? p : [only])), 0); return () => clearTimeout(t); }
  }, [accounts]);

  async function agent(payload: Record<string, unknown>): Promise<{ text?: string; variants?: Record<string, string> } | null> {
    const r = await api<{ text?: string; variants?: Record<string, string> }>("/api/founder/social/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "The AI agent could not run." }); return null; }
    return r.data;
  }
  async function template(key: TemplateKey) {
    setAiOpen(false);
    const out = await agent({ action: "template", template: key, notes: body, company: companyName });
    if (out?.text) { setBody(out.text); setMsg(null); }
  }
  async function transform(action: "shorten" | "hashtags") {
    setAiOpen(false);
    const out = await agent({ action, text: body, network: chosen[0]?.platform ?? "linkedin" });
    if (out?.text) setBody(out.text);
  }

  async function leaveTopic() {
    setMsg(null);
    if (topic !== "auto") {
      setBusy(true);
      const out = await agent({ action: "template", template: topic, notes: body, company: companyName });
      setBusy(false);
      if (!out?.text) return;
      setBody(out.text);
    }
    setStep(1);
  }

  async function save(saveMode: "draft" | "schedule" | "now" | "hold") {
    setMsg(null);
    if (!body.trim()) { setMsg({ ok: false, text: "Write something first." }); return; }
    if (chosen.length === 0) { setMsg({ ok: false, text: "Pick at least one connected account." }); return; }
    const scheduledAts: string[] = [];
    if (saveMode === "schedule") {
      for (const d of dates) {
        const at = ptLocalToIso(`${d}T${time || "08:15"}`);
        if (at) scheduledAts.push(at);
      }
      if (scheduledAts.length === 0 || scheduledAts.length !== dates.length) { setMsg({ ok: false, text: "Pick at least one date and a time (Pacific time)." }); return; }
    }
    setBusy(true);
    // Per network rewrite (never identical copy across accounts), then one post that counts once.
    let variants: { accountId: string; body: string }[] = chosen.map((a) => ({ accountId: a.id, body }));
    if (chosen.length > 1) {
      const out = await agent({ action: "variants", text: body, networks: [...new Set(chosen.map((a) => a.platform))] });
      if (out?.variants) variants = chosen.map((a) => ({ accountId: a.id, body: out.variants?.[a.platform] ?? body }));
    }
    if (saveMode === "schedule" && repeat !== "none") {
      const [datePart, timePart] = when.split("T");
      const [yy, mm, dd] = datePart.split("-").map(Number);
      const weekday = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
      const count = Math.max(2, Math.min(52, Number(repeatCount) || 8));
      const rr = await api<{ id?: string }>("/api/founder/social/recurrences", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freq: repeat, interval: 1, weekdays: repeat === "weekly" ? [weekday] : [], timeLocal: timePart, startDate: datePart,
          endType: "after", endCount: count, campaignId: campaignId || null, linkUrl: effectiveLink || null, comment: effectiveComment, body, variants,
        }),
      });
      setBusy(false);
      if (!rr.ok) { setMsg({ ok: false, text: rr.data.error ?? "Could not create the repeating post." }); return; }
      setBody("");
      await onSaved();
      setDone({ text: `Repeating post created, ${count} posts starting ${pt(ptLocalToIso(when), false)}. Each post counts toward your monthly limit when it is added, and any past the limit wait as drafts until it resets.`, postId: null });
      return;
    }
    const targets: (string | null)[] = saveMode === "schedule" ? scheduledAts : [null];
    let made = 0;
    let firstId: string | null = null;
    for (const scheduledAt of targets) {
      const r = await api<{ usage?: SocialUsage; postId?: string }>("/api/founder/social/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: saveMode, scheduledAt, campaignId: campaignId || null, linkUrl: effectiveLink || null, comment: effectiveComment, variants }),
      });
      if (!r.ok) {
        setBusy(false);
        const limit = r.status === 403 && r.data.code === "limit_reached";
        if (limit) { if (r.data.usage) setLocal(r.data.usage); setDialog(true); }
        if (made > 0) {
          setBody("");
          await onSaved();
          setDone({ text: `Scheduled ${made} of ${targets.length}. ${limit ? "You reached your monthly limit." : r.data.error ?? "The rest could not be saved."}`, postId: firstId });
        } else if (!limit) setMsg({ ok: false, text: r.data.error ?? "Could not save." });
        return;
      }
      if (made === 0) firstId = r.data.postId ?? null;
      made += 1;
    }
    setBusy(false);
    setDialog(false);
    if (saveMode !== "draft") setBody("");
    await onSaved();
    const first = scheduledAts[0] ? pt(scheduledAts[0]) : "";
    setDone({
      text: saveMode === "draft" ? "Draft saved." : saveMode === "hold" ? `Saved as a draft. We will remind you on ${pt(local.resetAt, false)}.`
        : saveMode === "now" ? "Queued. It publishes within 5 minutes. When it is live, View post opens the real post."
        : made > 1 ? `${made} posts scheduled, the first on ${first}.` : `Post scheduled for ${first}.`,
      postId: firstId,
    });
  }

  async function emailIt() {
    setMsg(null); setEmailed(false);
    if (!body.trim()) { setMsg({ ok: false, text: "Write something first." }); return; }
    setBusy(true);
    const r = await api<{ url?: string }>("/api/founder/social/email-draft", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: body.trim().split("\n")[0].slice(0, 80), body }),
    });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "Could not save the email draft." }); return; }
    setEmailed(true);
    setMsg({ ok: true, text: "Saved as a draft in Manual outreach. Open it to choose investors and send. Your plan's email limits apply there." });
  }
  async function openSend() {
    setMsg(null);
    if (!body.trim()) { setMsg({ ok: false, text: "Write something first." }); return; }
    setSendOpen(true);
    const r = await api<{ contacts: { id: string; name: string; firm: string | null; email: string }[]; remaining: number | null; limit: number | null }>("/api/founder/social/email-send");
    if (r.ok) { setContacts(r.data.contacts ?? []); setEmailsLeft({ remaining: r.data.remaining ?? null, limit: r.data.limit ?? null }); }
  }
  async function sendNow() {
    setMsg(null);
    if (chosenInvestors.length === 0) { setMsg({ ok: false, text: "Choose at least one investor." }); return; }
    setBusy(true);
    const r = await api<{ queued?: number; sent?: number; live?: boolean }>("/api/founder/social/email-send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: body.trim().split("\n")[0].slice(0, 80), body, recipientIds: chosenInvestors }),
    });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "Could not send the email." }); return; }
    setSendOpen(false); setChosenInvestors([]);
    setMsg({ ok: true, text: r.data.live === false
      ? `Added ${r.data.queued} investor${r.data.queued === 1 ? "" : "s"}. Live email is switched off on this account, so nothing was delivered.`
      : `Sent to ${r.data.sent ?? 0} of ${r.data.queued} investor${r.data.queued === 1 ? "" : "s"}. Any left over because of your monthly email limit go out after it resets.` });
  }

  if (done) {
    return (
      <DoneCard title={done.text.startsWith("Draft saved") || done.text.startsWith("Saved as a draft") ? "Saved" : done.text.startsWith("Queued") ? "Post queued" : "Done"} body={done.text}>
        {done.postId && <button type="button" className={btnPrimary} onClick={() => onView(done.postId as string)}>View post</button>}
        <button type="button" className={btn} onClick={() => { setDone(null); setStep(0); setTopic("auto"); setDates([]); setMsg(null); }}>Write another</button>
        <button type="button" className={btn} onClick={onExit}>Back to home</button>
      </DoneCard>
    );
  }

  const lastStep = step === LABELS.length - 1;
  const networksOk = chosen.length > 0;
  const whenOk = mode === "now" || dates.length > 0;
  const nextBlocked = noAccounts || (step === 1 && !body.trim()) || (step === 2 && !networksOk) || (step === 3 && !whenOk);
  const action = reached ? "Upgrade to schedule" : mode === "now" ? "Post now" : "Schedule post";
  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900";

  return (
    <WizardFrame title="Write a post" part="Launch my social media, part 3 of 4" labels={LABELS} step={step}
      onBack={() => { setMsg(null); setStep((s) => Math.max(0, s - 1)); }}
      onNext={() => {
        if (step === 0) void leaveTopic();
        else if (!lastStep) { setMsg(null); setStep((s) => s + 1); }
        else if (reached) setDialog(true);
        else void save(mode);
      }}
      nextLabel={lastStep ? action : "Next"} nextDisabled={nextBlocked} busy={busy} onExit={onExit}
      extraFooter={lastStep ? <button type="button" className={btn} disabled={busy || noAccounts} onClick={() => void save("draft")}>Save draft</button> : null}>
      {noAccounts && <NotConnectedNote acting={acting} onConnect={onConnect} />}
      {local.state === "warn" && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{local.remaining} post{local.remaining === 1 ? "" : "s"} left this month. Your limit resets {pt(local.resetAt, false)}.</div>}
      {reached && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          You&rsquo;ve used all {local.limit} posts on {local.planType?.replace("founder_", "").replace(/^./, (c) => c.toUpperCase())} this month. Your limit resets {pt(local.resetAt, false)}. Posts you already scheduled will still go out, and you can still save drafts.
        </div>
      )}
      <fieldset disabled={noAccounts} className={noAccounts ? "opacity-50" : ""}>
        {step === 0 && (
          <div>
            <h3 className="text-base font-semibold text-slate-900">What do you want to say?</h3>
            <p className="mt-1 text-sm text-slate-600">The AI agent writes a short draft from your company profile. You review every word.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TOPICS.map((t) => (
                <label key={t.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${topic === t.key ? "border-2 border-[#1A6CE4] bg-blue-50" : "border-slate-200 bg-white"}`}>
                  <input type="radio" name="topic" className="mt-1" checked={topic === t.key} onChange={() => setTopic(t.key)} />
                  <span><span className="block text-sm font-medium text-slate-900">{t.title}</span><span className="block text-xs text-slate-500">{t.note}</span></span>
                </label>
              ))}
            </div>
            <label className="mt-3 block max-w-sm text-xs text-slate-500">Campaign
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={input}>
                <option value="">None</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {msg && !msg.ok && <p className="mt-2 text-xs text-red-700" role="alert">{msg.text}</p>}
          </div>
        )}
        {step === 1 && (
          <div>
            <h3 className="text-base font-semibold text-slate-900">Your draft</h3>
            <p className="mt-1 text-sm text-slate-600">Short and direct. Edit it in your own words. Your draft is kept on this device as you type.</p>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Write your post, or jot a few notes and pick a topic from the AI agent menu." className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="relative" ref={aiRef}>
                <button type="button" aria-haspopup="menu" aria-expanded={aiOpen} onClick={() => setAiOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-100">
                  <span aria-hidden="true">✦</span> AI agent
                </button>
                {aiOpen && (
                  <div role="menu" className="absolute left-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    <button type="button" role="menuitem" className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50" onClick={() => { setBody(initialDraft); setAiOpen(false); setMsg(null); }}>Regenerate draft</button>
                    {TEMPLATE_KEYS.map((k) => (
                      <button key={k} type="button" role="menuitem" className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50" onClick={() => void template(k)}>{TEMPLATE_LABELS[k]}</button>
                    ))}
                    <button type="button" role="menuitem" className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50" onClick={() => void transform("shorten")}>Shorten</button>
                    <button type="button" role="menuitem" className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50" onClick={() => void transform("hashtags")}>Add hashtags</button>
                  </div>
                )}
              </div>
              <span className="text-xs text-slate-500">{body.length.toLocaleString()} characters</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Free mode. Drafts never count toward your post limit.</p>
            {msg && !msg.ok && <p className="mt-2 text-xs text-red-700" role="alert">{msg.text}</p>}
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Where should it go?</h3>
              <p className="mt-1 text-sm text-slate-600">The preview updates as you choose.</p>
              {accounts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No connected accounts yet. <button type="button" className="font-medium text-[#1A6CE4] hover:underline" onClick={onConnect}>Connect one</button>.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {accounts.map((a) => {
                    const on = picked.includes(a.id);
                    return (
                      <button key={a.id} type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                        className={`rounded-full border px-3 py-1 text-sm ${on ? "border-[#1A6CE4] bg-blue-50 text-[#1A6CE4]" : "border-slate-300 text-slate-600"}`}>
                        {PLATFORM_LABEL[a.platform] ?? a.platform}{a.displayName ? `: ${a.displayName}` : ""}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-4">
                <div className="text-xs text-slate-500">Attachment</div>
                <button type="button" aria-pressed={useAgent} disabled={!agentUrl} onClick={() => setAgentOn((v) => !v)}
                  className={`mt-1.5 flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${useAgent ? "border-2 border-[#1A6CE4] bg-blue-50" : "border-slate-200 bg-white"}`}>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-slate-900">Agent link</span>
                    <span className="block text-[11px] text-slate-500">{agentLinks === undefined ? "Checking your IR agent" : agentUrl ? "Your IR agent, tracks the social channel" : "Go live in My IR Agent first"}</span>
                  </span>
                  {useAgent && <span className="rounded-full bg-[#1A6CE4] px-1.5 text-xs text-white" aria-hidden="true">✓</span>}
                </button>
                {useAgent && <p className="mt-1 text-xs text-slate-500">Posts as the first comment, tracked to this network. Clicks and chats count toward this post in your results.</p>}
              </div>
            </div>
            <SocialPreview body={body} network={shownNet} onNetwork={setPreviewNet} name={founderName} company={companyName} linkUrl={effectiveLink} firstComment={useAgent && shownNet !== "reddit" ? `${AGENT_COMMENT} ${effectiveLink}` : null} />
          </div>
        )}
        {step === 3 && (
          <div>
            <h3 className="text-base font-semibold text-slate-900">When should it post?</h3>
            <p className="mt-1 text-sm text-slate-600">All times are Pacific (PT).</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === "now" ? "border-2 border-[#1A6CE4] bg-blue-50" : "border-slate-200"}`}>
                <input type="radio" name="when" className="mt-1" checked={mode === "now"} onChange={() => setMode("now")} />
                <span><span className="block text-sm font-medium text-slate-900">Post now</span><span className="block text-xs text-slate-500">Goes out within 5 minutes</span></span>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === "schedule" ? "border-2 border-[#1A6CE4] bg-blue-50" : "border-slate-200"}`}>
                <input type="radio" name="when" className="mt-1" checked={mode === "schedule"} onChange={() => setMode("schedule")} />
                <span><span className="block text-sm font-medium text-slate-900">Schedule</span><span className="block text-xs text-slate-500">Pick one or more days and a time</span></span>
              </label>
            </div>
            {mode === "schedule" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="text-xs text-slate-500 sm:col-span-2">Dates and time (PT)
                  <MultiDatePicker dates={dates} onDates={setDates} time={time} onTime={setTime} />
                  {repeat !== "none" && dates.length > 1 && <p className="mt-1">A repeating post starts on the first date you picked, {dates[0]}.</p>}
                </div>
                <label className="text-xs text-slate-500">Repeat
                  <select value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)} className={input}>
                    <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                  </select>
                </label>
                {repeat !== "none" && (
                  <label className="text-xs text-slate-500">Number of posts
                    <input inputMode="numeric" value={repeatCount} onChange={(e) => setRepeatCount(e.target.value.replace(/[^0-9]/g, ""))} className={input} />
                  </label>
                )}
              </div>
            )}
            <p className={`mt-3 text-xs ${reached ? "text-red-700" : "text-slate-500"}`}>{local.limit === null ? "Unlimited posts" : reached ? `${local.used} of ${local.limit} used` : `${local.remaining} of ${local.limit} posts left this cycle`}</p>
          </div>
        )}
        {step === 4 && (
          <div>
            <h3 className="text-base font-semibold text-slate-900">Review and {mode === "now" ? "post" : "schedule"}</h3>
            <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
              <div className="flex justify-between gap-3 px-3 py-2"><dt className="shrink-0 text-slate-500">Post</dt><dd className="min-w-0 truncate text-slate-900">{body.split("\n")[0]}</dd></div>
              <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">Network</dt><dd className="text-right text-slate-900">{chosen.map((a) => `${PLATFORM_LABEL[a.platform] ?? a.platform}${a.displayName ? `, ${a.displayName}` : ""}`).join("; ")}</dd></div>
              <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">Agent link</dt><dd className="text-slate-900">{useAgent ? "As first comment" : "Not attached"}</dd></div>
              <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">When</dt><dd className="text-right text-slate-900">{mode === "now" ? "Now" : dates.length === 0 ? "No date picked" : `${dates.length > 1 ? `${dates.length} days, first ` : ""}${pt(ptLocalToIso(when))}${repeat !== "none" ? `, repeats ${repeat}` : ""}`}</dd></div>
              <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">Campaign</dt><dd className="text-slate-900">{campaigns.find((c) => c.id === campaignId)?.name ?? "None"}</dd></div>
            </dl>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Public posts about a raise can count as general solicitation. Check with your securities counsel before you post about an offering. {FOUNDER_SOCIAL_DISCLAIMER}</p>
            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <div className="text-sm font-semibold text-slate-900">Also email this to investors</div>
              <p className="mt-1 text-xs text-slate-500">Optional. Your plan&rsquo;s email limits apply.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={btn} disabled={busy} onClick={() => void emailIt()}>Save as email draft</button>
                <button type="button" className={btn} disabled={busy} onClick={() => void openSend()}>Send as email now</button>
              </div>
              {sendOpen && (
                <div className="mt-3 rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">{emailsLeft.remaining != null ? `${emailsLeft.remaining}${emailsLeft.limit != null ? ` of ${emailsLeft.limit}` : ""} emails left this month. ` : ""}Each investor you pick uses one.</p>
                  {contacts.length === 0 ? <p className="mt-2 text-sm text-slate-600">No investors with an email in your list yet. Add them in Manual outreach first.</p> : (
                    <div className="mt-2 max-h-48 overflow-y-auto">
                      {contacts.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 py-1 text-sm text-slate-800">
                          <input type="checkbox" checked={chosenInvestors.includes(c.id)} onChange={() => setChosenInvestors((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} />
                          <span className="truncate">{c.name}{c.firm ? `, ${c.firm}` : ""}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={btnPrimary} disabled={busy || chosenInvestors.length === 0} onClick={() => void sendNow()}>Send to {chosenInvestors.length || "…"} now</button>
                    <button type="button" className={btn} disabled={busy} onClick={() => setSendOpen(false)}>Cancel</button>
                  </div>
                </div>
              )}
              {emailed && <Link href="/founder/deploy" className="mt-2 inline-block text-xs font-medium text-[#1A6CE4] hover:underline">Open Manual outreach</Link>}
            </div>
            {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
          </div>
        )}
      </fieldset>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Monthly post limit reached">
          <div className="w-full max-w-sm rounded-xl bg-white p-5">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-slate-900">Monthly post limit reached</h3>
              <button type="button" aria-label="Close" className="text-slate-400 hover:text-slate-700" onClick={() => setDialog(false)}>✕</button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Your plan includes up to {local.limit} posts a month. Upgrade for a higher limit, or wait until your limit resets on {pt(local.resetAt, false)}.</p>
            <Link href="/pricing" className="mt-4 block rounded-lg bg-[#1A6CE4] px-3 py-2 text-center text-sm font-medium text-white hover:bg-[#2E78F5]">Upgrade your plan</Link>
            <button type="button" className={`${btn} mt-2 w-full`} disabled={busy} onClick={() => void save("hold")}>Save as draft for {pt(local.resetAt, false)}</button>
            <p className="mt-2 text-xs text-slate-500">Saved drafts never post automatically. We will remind you on {pt(local.resetAt, false)}.</p>
          </div>
        </div>
      )}
    </WizardFrame>
  );
}
