"use client";

import { useState } from "react";
import { PLATFORM_LABEL, api, btn, btnPrimary, card, pt, type Post } from "@/components/founder/social/FounderSocialShared";
import { livePostUrl, postState } from "@/lib/social/launch";

/** One post: its state, where it goes, and a link to the real post once it is live. */
export function PostView({ post, onBack, onChanged }: { post: Post; onBack: () => void; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const state = postState(post);
  const url = livePostUrl(post);
  const nets = [...new Set(post.variants.map((v) => v.account?.platform).filter((p): p is string => Boolean(p)))].map((p) => PLATFORM_LABEL[p] ?? p);
  const net = nets[0] ?? "the network";

  async function act(action: "archive" | "unarchive" | "delete") {
    setBusy(true);
    await api("/api/founder/social/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id, action }) });
    await onChanged();
    setBusy(false);
    if (action === "delete") onBack();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" className="mb-2 text-xs font-medium text-slate-500 hover:text-slate-800" onClick={onBack}>← Back to home</button>
      <h2 className="text-xl font-semibold text-slate-900">View post</h2>
      <div className={`${card} mt-3`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{state.label}</span>
          {nets.length > 0 && <span className="text-slate-500">{nets.join(", ")}</span>}
          {post.campaign && <span className="text-slate-500">Campaign: {post.campaign.name}</span>}
          {post.scheduled_at && <span className="text-slate-500">{state.key === "published" ? "Went out" : "Goes out"} {pt(post.scheduled_at)}</span>}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-900">{post.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>View on {net}</a>
          ) : (
            <button type="button" className={btnPrimary} disabled>View on {net}</button>
          )}
          {!url && <span className="text-xs text-slate-500">{state.key === "failed" ? "This post did not go out." : "Available once the post is published."}</span>}
          <span className="ml-auto flex gap-2">
            <button type="button" className={btn} disabled={busy} onClick={() => void act(post.archived_at ? "unarchive" : "archive")}>{post.archived_at ? "Restore" : "Archive"}</button>
            <button type="button" className={btn} disabled={busy} onClick={() => void act("delete")}>Delete</button>
          </span>
        </div>
        {state.key === "published" && <p className="mt-2 text-xs text-slate-500">Deleting here removes it from your list only. The post stays on {net}.</p>}
      </div>
    </div>
  );
}
