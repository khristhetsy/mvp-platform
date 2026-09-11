"use client";

import { useEffect, useState } from "react";
import { AiCmo } from "./AiCmo";

type LibPost = { id: string; body: string; archetype: string | null; campaign_id: string | null; campaign_name: string | null; archived: boolean; published: number; clicks: number; top: boolean };
type Campaign = { id: string; name: string };

export function Library() {
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [posts, setPosts] = useState<LibPost[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dup, setDup] = useState<string | null>(null);           // postId being duplicated
  const [dupSel, setDupSel] = useState<Set<string>>(new Set());  // target campaign ids
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const [p, c] = await Promise.all([
        fetch(`/api/admin/social/library?scope=${scope}`).then((r) => r.json()),
        fetch(`/api/admin/social/campaigns`).then((r) => r.json()),
      ]);
      setPosts(p.posts ?? []);
      setCampaigns((c.campaigns ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
    } catch { setPosts([]); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`/api/admin/social/library?scope=${scope}`).then((r) => r.json()),
      fetch(`/api/admin/social/campaigns`).then((r) => r.json()),
    ]).then(([p, c]) => {
      if (!live) return;
      setPosts(p.posts ?? []);
      setCampaigns((c.campaigns ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
      setLoading(false);
    }).catch(() => { if (live) { setPosts([]); setLoading(false); } });
    return () => { live = false; };
  }, [scope]);

  async function lifecycle(postId: string, action: "archive" | "unarchive" | "delete") {
    if (action === "delete" && !confirm("Delete this post? Its past published metrics stay in reporting.")) return;
    setBusy(true);
    await fetch("/api/admin/social/posts/lifecycle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postId, action }) }).catch(() => {});
    setBusy(false); void load();
  }

  async function runDuplicate() {
    if (!dup || dupSel.size === 0) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/social/posts/duplicate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postId: dup, campaignIds: [...dupSel] }) });
      const d = await res.json().catch(() => ({}));
      setMsg(res.ok ? `Created ${d.created?.length ?? 0} clone(s) as drafts.` : "Could not duplicate.");
      if (res.ok) { setDup(null); setDupSel(new Set()); }
    } catch { setMsg("Could not duplicate."); }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px]">
        {(["active", "archived"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setScope(s)} className={`rounded-full px-3 py-1 capitalize ${scope === s ? "border border-indigo-300 text-indigo-700" : "border border-slate-200 text-slate-500"}`}>{s}</button>
        ))}
        {loading ? <span className="text-slate-400">Loading…</span> : null}
        {msg ? <span className="text-slate-500">{msg}</span> : null}
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {posts.map((p) => (
          <div key={p.id} className="px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              {p.top ? <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-700">★ Top</span> : (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-500">{p.archetype ?? "Post"}</span>
              )}
              <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700">{p.body || "(no text)"}</span>
              <span className="hidden text-[10.5px] text-slate-400 sm:inline">{p.campaign_name ?? "No campaign"} · {p.published} published{p.clicks > 0 ? ` · ${p.clicks} clicks` : ""}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => { setDup(dup === p.id ? null : p.id); setDupSel(new Set()); }} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[10.5px] font-medium text-white">⧉ Duplicate</button>
              {p.archived
                ? <button type="button" disabled={busy} onClick={() => void lifecycle(p.id, "unarchive")} className="rounded-md border border-slate-300 px-2.5 py-1 text-[10.5px] text-slate-600">Restore</button>
                : <button type="button" disabled={busy} onClick={() => void lifecycle(p.id, "archive")} className="rounded-md border border-slate-300 px-2.5 py-1 text-[10.5px] text-slate-600">📥 Archive</button>}
              <button type="button" disabled={busy} onClick={() => void lifecycle(p.id, "delete")} className="rounded-md border border-rose-200 px-2.5 py-1 text-[10.5px] text-rose-600">🗑 Delete</button>
            </div>

            {dup === p.id ? (
              <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5">
                <div className="mb-1.5 text-[11px] font-medium text-slate-700">Duplicate into campaigns — one clone each, each with its own tracking tag:</div>
                <div className="flex flex-wrap gap-1.5">
                  {campaigns.map((c) => {
                    const on = dupSel.has(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => setDupSel((prev) => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                        className={`rounded-md px-2.5 py-1 text-[11px] ${on ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{c.name} {on ? "✓" : "+"}</button>
                    );
                  })}
                  {!campaigns.length ? <span className="text-[11px] text-slate-400">No campaigns to target.</span> : null}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" disabled={busy || dupSel.size === 0} onClick={() => void runDuplicate()} className="rounded-md bg-indigo-600 px-3 py-1 text-[11px] font-medium text-white disabled:opacity-50">Create {dupSel.size || ""} clone{dupSel.size === 1 ? "" : "s"}</button>
                  <button type="button" onClick={() => setDup(null)} className="text-[11px] text-slate-500">Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {!loading && !posts.length ? <div className="p-6 text-center text-[12px] text-slate-400">No {scope} posts.</div> : null}
      </div>

      <AiCmo tab="Library" context={() => ({ scope, count: posts.length, top: posts.filter((p) => p.top).length })} />
    </div>
  );
}
