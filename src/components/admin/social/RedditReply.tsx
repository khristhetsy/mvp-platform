"use client";

import { useEffect, useMemo, useState } from "react";
import { LINK_TOKEN, REDDIT_TEMPLATES, buildReply, isRedditThreadUrl, type RedditCampaign, type RedditReply as Reply } from "@/lib/social/reddit";

const card = "rounded-xl border border-slate-200 bg-white";
const field = "rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none";

/**
 * Reddit reply composer (manual channel). Staff paste a Reddit thread link, pick a
 * template, get a tracked link, copy the finished reply to Reddit, then mark it posted.
 * No Reddit API: nothing is posted on anyone's behalf.
 */
export function RedditReply() {
  const [campaigns, setCampaigns] = useState<RedditCampaign[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [newName, setNewName] = useState<string | null>(null);
  const [threadUrl, setThreadUrl] = useState("");
  const [templateKey, setTemplateKey] = useState(REDDIT_TEMPLATES[0].key);
  const [body, setBody] = useState(REDDIT_TEMPLATES[0].body);
  const [postId, setPostId] = useState<string | null>(null);
  const [trackedUrl, setTrackedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  function apply(d: { campaigns?: RedditCampaign[]; replies?: Reply[] }) {
    const cs = d.campaigns ?? [];
    setCampaigns(cs);
    setReplies(d.replies ?? []);
    setCampaignId((cur) => cur || cs[0]?.id || "");
  }
  function fetchData(): Promise<{ campaigns?: RedditCampaign[]; replies?: Reply[] }> {
    return fetch("/api/admin/social/reddit").then((r) => r.json());
  }
  async function load() {
    try { apply(await fetchData()); } catch { /* keep what we have */ }
  }
  useEffect(() => {
    let live = true;
    fetchData().then((d) => { if (live) apply(d); }).catch(() => { /* keep what we have */ });
    return () => { live = false; };
  }, []);

  const hasLink = body.includes(LINK_TOKEN);
  const finalText = useMemo(() => buildReply(body, trackedUrl), [body, trackedUrl]);
  const threadOk = isRedditThreadUrl(threadUrl);

  function pickTemplate(key: string) {
    const t = REDDIT_TEMPLATES.find((x) => x.key === key);
    setTemplateKey(key);
    if (t) setBody(t.body);
  }

  async function post(payload: object): Promise<Record<string, unknown>> {
    const r = await fetch("/api/admin/social/reddit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j as { error?: string }).error ?? "Something went wrong. Try again.");
    return j as Record<string, unknown>;
  }

  async function createCampaign() {
    if (!newName?.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const j = await post({ action: "campaign", name: newName.trim() });
      const c = j.campaign as RedditCampaign;
      setCampaigns((p) => [c, ...p]); setCampaignId(c.id); setNewName(null);
    } catch (e) { setMsg({ tone: "warn", text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function getLink() {
    setBusy(true); setMsg(null);
    try {
      const j = await post({ action: "draft", campaignId, threadUrl: threadUrl.trim(), body });
      setPostId(String(j.postId)); setTrackedUrl(String(j.trackedUrl));
    } catch (e) { setMsg({ tone: "warn", text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(finalText); setMsg({ tone: "ok", text: "Reply copied. Paste it on Reddit, then mark it posted." }); }
    catch { setMsg({ tone: "warn", text: "Couldn't copy. Select the preview text and copy it instead." }); }
  }

  function reset() {
    setPostId(null); setTrackedUrl(null); setThreadUrl(""); pickTemplate(REDDIT_TEMPLATES[0].key);
  }

  async function markPosted() {
    if (!postId) return;
    setBusy(true); setMsg(null);
    try {
      await post({ action: "posted", postId, body: finalText });
      reset(); setMsg({ tone: "ok", text: "Marked as posted. Clicks and bookings from this link now count to Reddit." });
      void load();
    } catch (e) { setMsg({ tone: "warn", text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  async function discard() {
    if (postId) await post({ action: "discard", postId }).catch(() => null);
    reset(); setMsg(null);
  }

  // A link-free template needs no tracked link, but still needs a saved record to count.
  const canGetLink = threadOk && Boolean(campaignId) && body.trim().length > 0 && !postId && !busy;

  return (
    <div className="space-y-5">
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-2">
          <i className="ti ti-brand-reddit text-[18px] text-slate-700" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold text-slate-900">New Reddit reply</h2>
          <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">Manual post</span>
        </div>
        <p className="mt-0.5 text-[12px] text-slate-500">You post from your own Reddit account. Answer the question fully first; keep links to a minority of your replies so the account stays in good standing.</p>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-[12px] font-medium text-slate-700">Reddit thread link</p>
            <input value={threadUrl} onChange={(e) => setThreadUrl(e.target.value)} disabled={Boolean(postId)} placeholder="https://www.reddit.com/r/startups/comments/abc123/…" className={`${field} mt-1.5 w-full`} />
            {threadUrl && !threadOk ? <p className="mt-1 text-[11.5px] text-red-600">Paste a Reddit thread link (reddit.com/r/…/comments/…).</p> : null}
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-[12px] font-medium text-slate-700">Template</p>
              <select value={templateKey} onChange={(e) => pickTemplate(e.target.value)} disabled={Boolean(postId)} className="mt-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px]">
                {REDDIT_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[12px] font-medium text-slate-700">Reddit campaign</p>
              <div className="mt-1.5 flex items-center gap-2">
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} disabled={Boolean(postId)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px]">
                  {campaigns.length ? null : <option value="">Create one first</option>}
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setNewName(newName === null ? "" : null)} disabled={Boolean(postId)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50">＋ New</button>
              </div>
              {newName !== null ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Reddit Q4" className="rounded-md border border-slate-200 px-2 py-1 text-[12px]" />
                  <button type="button" onClick={() => void createCampaign()} disabled={!newName.trim() || busy} className="rounded-md bg-indigo-600 px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50">Create</button>
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <p className="text-[12px] font-medium text-slate-700">Reply</p>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={Boolean(postId)} rows={6} className={`${field} mt-1.5 w-full`} />
            <p className="mt-1 text-[11px] text-slate-400">{hasLink ? `${LINK_TOKEN} becomes your tracked link.` : "No link in this reply. Add [link] where you want one."} The iCFO disclaimer is added automatically.</p>
          </div>

          {!postId ? (
            <button type="button" onClick={() => void getLink()} disabled={!canGetLink} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {busy ? "Saving…" : hasLink ? "Get tracked link" : "Prepare reply"}
            </button>
          ) : (
            <div className="space-y-3">
              {hasLink && trackedUrl ? (
                <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <p className="text-[11.5px] text-slate-500">Tracked link, inserted automatically</p>
                  <code className="mt-0.5 block truncate text-[12.5px] text-indigo-700">{trackedUrl}</code>
                  <p className="mt-0.5 text-[11px] text-slate-400">Opens /fit tagged to this Reddit campaign.</p>
                </div>
              ) : null}
              <div>
                <p className="text-[12px] font-medium text-slate-700">Preview</p>
                <pre className="mt-1.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 font-sans text-[13px] text-slate-800">{finalText}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void copy()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><i className="ti ti-copy" aria-hidden="true" /> Copy reply</button>
                <button type="button" onClick={() => void markPosted()} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><i className="ti ti-check" aria-hidden="true" /> Mark as posted</button>
                <button type="button" onClick={() => void discard()} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Discard</button>
              </div>
            </div>
          )}

          {msg ? <p className={`text-[12.5px] ${msg.tone === "ok" ? "text-emerald-700" : "text-amber-700"}`}>{msg.text}</p> : null}
        </div>
      </div>

      <div className={`${card} p-5`}>
        <h3 className="text-[13px] font-semibold text-slate-800">Recent Reddit replies</h3>
        {replies.length ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {replies.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2 text-[12.5px]">
                {r.thread_url ? <a href={r.thread_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-indigo-700 hover:underline">{r.thread ?? r.thread_url}</a> : <span className="min-w-0 flex-1 truncate text-slate-500">No thread</span>}
                <span className="text-slate-500">{r.campaign_name ?? ""}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${r.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{r.status === "published" ? "Posted" : "Draft"}</span>
                <span className="w-16 text-right text-slate-600">{r.clicks} {r.clicks === 1 ? "click" : "clicks"}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-[12.5px] text-slate-500">Your posted replies show here with their clicks. Meetings and signups show under Attribution and Campaigns and Goals.</p>}
      </div>
    </div>
  );
}
