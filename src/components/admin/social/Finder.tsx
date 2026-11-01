"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FINDER_PLATFORM_LABEL, MATCH_LABEL, detectPlatform, suggestTemplateKey,
  type FinderAudience, type FinderHit, type FinderSignal, type MatchLevel,
} from "@/lib/social/finder";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { FinderGuide } from "./FinderGuide";

const card = "rounded-xl border border-slate-200 bg-white";
const field = "rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none";
const LEVEL_CLS: Record<MatchLevel, string> = { strong: "bg-emerald-50 text-emerald-700", good: "bg-blue-50 text-blue-700", review: "bg-amber-50 text-amber-700" };

const SEARCH_FIELDS: SearchField<FinderHit>[] = [
  { label: "conversation", get: (h) => h.excerpt },
  { label: "link", get: (h) => h.thread_url },
  { label: "handle", get: (h) => h.author_handle },
  { label: "platform", get: (h) => FINDER_PLATFORM_LABEL[h.platform] },
  { label: "audience", get: (h) => h.audience },
];

export type RedditPrefill = { threadUrl: string; templateKey: string; hitId: string };

/**
 * Conversation finder. Staff paste a link to a public conversation; the finder classifies it,
 * checks the signal phrases and hands founder conversations to the existing Reddit reply composer.
 * It posts nothing. Investor conversations are held: no public reply.
 */
export function Finder({ onOpenReddit }: { onOpenReddit: (p: RedditPrefill) => void }) {
  const [signals, setSignals] = useState<FinderSignal[]>([]);
  const [hits, setHits] = useState<FinderHit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [url, setUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [handle, setHandle] = useState("");
  const [audience, setAudience] = useState<"auto" | FinderAudience>("auto");
  const [filter, setFilter] = useState<"all" | FinderAudience>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  async function call(payload: object): Promise<Record<string, unknown>> {
    const r = await fetch("/api/admin/social/finder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j as { error?: string }).error ?? "Something went wrong. Try again.");
    return j as Record<string, unknown>;
  }

  useEffect(() => {
    let live = true;
    fetch("/api/admin/social/finder").then((r) => r.json()).then((d: { signals?: FinderSignal[]; hits?: FinderHit[] }) => {
      if (!live) return;
      setSignals(d.signals ?? []); setHits(d.hits ?? []); setLoaded(true);
    }).catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);

  async function addSignal() {
    if (phrase.trim().length < 2) { setMsg({ tone: "warn", text: "Enter a phrase of at least two characters." }); return; }
    setBusy(true); setMsg(null);
    try {
      const j = await call({ action: "signal_add", phrase: phrase.trim() });
      setSignals((p) => [...p, j.signal as FinderSignal]); setPhrase("");
    } catch (e) { setMsg({ tone: "warn", text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function removeSignal(id: string) {
    setMsg(null);
    try { await call({ action: "signal_remove", id }); setSignals((p) => p.filter((s) => s.id !== id)); }
    catch (e) { setMsg({ tone: "warn", text: (e as Error).message }); }
  }

  async function addHit() {
    setBusy(true); setMsg(null);
    try {
      const j = await call({ action: "hit_add", threadUrl: url.trim(), excerpt, authorHandle: handle.trim() || undefined, audience: audience === "auto" ? undefined : audience });
      const hit = j.hit as FinderHit;
      setHits((p) => [hit, ...p]); setUrl(""); setExcerpt(""); setHandle(""); setAudience("auto");
      setMsg({ tone: "ok", text: hit.status === "held" ? "Saved as held. Investor conversations get no public reply." : "Saved. Open it in the Reddit reply composer when you are ready." });
    } catch (e) { setMsg({ tone: "warn", text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function setStatus(id: string, status: "replied" | "skipped") {
    setMsg(null);
    try { await call({ action: "hit_status", id, status }); setHits((p) => p.map((h) => (h.id === id ? { ...h, status } : h))); }
    catch (e) { setMsg({ tone: "warn", text: (e as Error).message }); }
  }

  const base = useMemo(() => hits.filter((h) => filter === "all" || h.audience === filter), [hits, filter]);
  const result = useMemo(() => matchRows(base, SEARCH_FIELDS, q), [base, q]);
  const signalText = (h: FinderHit) => signals.find((s) => s.id === h.signal_id)?.phrase ?? null;

  return (
    <div className="space-y-5">
      <div className="flex">
        <button type="button" onClick={() => setGuideOpen(true)} className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">? How to use</button>
      </div>
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-slate-900">Signals</h2>
          <span className="ml-auto text-[11.5px] text-slate-500">Phrases the finder looks for in a saved conversation</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {signals.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-[12.5px] text-indigo-700">
              {s.phrase}
              <button type="button" onClick={() => void removeSignal(s.id)} aria-label={`Remove ${s.phrase}`} className="text-indigo-400 hover:text-indigo-700"><i className="ti ti-x" aria-hidden="true" /></button>
            </span>
          ))}
          {loaded && !signals.length ? <span className="text-[12.5px] text-slate-500">No phrases yet. Add one below.</span> : null}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={phrase} onChange={(e) => setPhrase(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addSignal(); }} placeholder="raising a seed round" className={`${field} min-w-0 flex-1`} />
          <button type="button" onClick={() => void addSignal()} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Add</button>
        </div>
      </div>

      <div className={`${card} p-5`}>
        <h2 className="text-[15px] font-semibold text-slate-900">Add a conversation</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">Paste the link and a line or two from it. Reddit, LinkedIn and X links work. Nothing is posted from here.</p>
        <div className="mt-3 space-y-3">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.reddit.com/r/startups/comments/abc123/…" className={`${field} w-full`} />
          {url.trim() && !detectPlatform(url) ? <p className="text-[11.5px] text-red-600">Use an https link from Reddit, LinkedIn or X.</p> : null}
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} placeholder="What they wrote" className={`${field} w-full`} />
          <div className="flex flex-wrap gap-3">
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle (optional)" className={`${field} w-44`} />
            <select value={audience} onChange={(e) => setAudience(e.target.value as "auto" | FinderAudience)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px]" aria-label="Who is talking">
              <option value="auto">Detect who is talking</option>
              <option value="founder">Founder</option>
              <option value="investor">Investor</option>
            </select>
            <button type="button" onClick={() => void addHit()} disabled={busy || !url.trim() || !excerpt.trim()} className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? "Saving…" : "Save conversation"}</button>
          </div>
        </div>
        {msg ? <p className={`mt-3 text-[12.5px] ${msg.tone === "ok" ? "text-emerald-700" : "text-amber-700"}`}>{msg.text}</p> : null}
      </div>

      <div className={`${card} p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-slate-900">Conversations</h2>
          <div className="ml-auto inline-flex rounded-lg border border-slate-200 p-0.5">
            {(["all", "founder", "investor"] as const).map((k) => (
              <button type="button" key={k} onClick={() => setFilter(k)} className={`rounded-md px-3 py-1 text-[12.5px] font-medium ${filter === k ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700"}`}>{k === "all" ? "All" : k === "founder" ? "Founders" : "Investors"}</button>
            ))}
          </div>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" className={`${field} mt-3 w-full`} />
        <SearchCount result={result} noun="conversations" className="mt-2" />

        <div className="mt-3 space-y-3">
          {!loaded ? <p className="text-[12.5px] text-slate-500">Loading…</p> : null}
          {loaded && !hits.length ? <p className="text-[12.5px] text-slate-500">No conversations saved yet. Paste a link above to add the first one.</p> : null}
          {hits.length > 0 && result.active && !result.rows.length ? <NoSearchMatches query={q} fields={SEARCH_FIELDS.map((f) => f.label)} onClear={() => setQ("")} /> : null}
          {result.rows.map((h) => {
            const sig = signalText(h);
            const platformLabel = FINDER_PLATFORM_LABEL[h.platform];
            return (
              <div key={h.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                  <span>{platformLabel}, {h.audience}{h.author_handle ? <> · <Highlight text={h.author_handle} query={q} /></> : null}</span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-medium ${h.status === "replied" ? "bg-emerald-50 text-emerald-700" : h.status === "held" ? "bg-amber-50 text-amber-700" : h.status === "skipped" ? "bg-slate-100 text-slate-500" : LEVEL_CLS[h.match_level]}`}>
                    {h.status === "replied" ? "Replied" : h.status === "held" ? "Held, no public reply" : h.status === "skipped" ? "Skipped" : MATCH_LABEL[h.match_level]}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-slate-800"><Highlight text={h.excerpt} query={q} /></p>
                <p className="mt-1 text-[11.5px] text-slate-400">{sig ? <>Matched &ldquo;{sig}&rdquo; · </> : null}<a href={h.thread_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Open conversation</a></p>
                {h.status === "new" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {h.platform === "reddit" ? (
                      <button type="button" onClick={() => onOpenReddit({ threadUrl: h.thread_url, templateKey: suggestTemplateKey(h.excerpt), hitId: h.id })} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700"><i className="ti ti-brand-reddit" aria-hidden="true" /> Open in Reddit reply</button>
                    ) : (
                      <button type="button" onClick={() => void setStatus(h.id, "replied")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">Mark replied</button>
                    )}
                    <button type="button" onClick={() => void setStatus(h.id, "skipped")} className="rounded-lg px-3 py-1.5 text-[12.5px] text-slate-500 hover:text-slate-700">Skip</button>
                  </div>
                ) : null}
                {h.status === "held" ? (
                  <div className="mt-2">
                    <p className="text-[12px] text-slate-500">Investor conversations get no public reply. Go through your approval gate.</p>
                    <button type="button" onClick={() => void setStatus(h.id, "skipped")} className="mt-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50">Dismiss</button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {guideOpen && <FinderGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
