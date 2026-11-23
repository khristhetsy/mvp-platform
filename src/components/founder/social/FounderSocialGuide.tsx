"use client";

import { useState } from "react";

const PARTS: { title: string; sub: string; steps: string[] }[] = [
  { title: "Connect an account", sub: "Network, Approve, Confirm", steps: ["Pick LinkedIn, Facebook, Instagram or Reddit", "Approve access on the network, then come back", "Check the account that will be used"] },
  { title: "Create a campaign", sub: "Name, Goals, Alerts, Review", steps: ["Name the campaign", "Set optional monthly goals", "Turn on optional behind pace alerts", "Review and create"] },
  { title: "Write a post", sub: "Topic, Draft, Networks, When, Review", steps: ["Pick a topic, the AI agent writes a draft", "Edit it in your own words", "Choose networks, see the preview, attach your Agent link", "Post now or pick dates in PT", "Review and schedule"] },
  { title: "Weekly review", sub: "Funnel, Weakest step, What worked, Next post", steps: ["See outreach, clicks and meetings", "See the step furthest below its goal", "See which campaign worked", "Write the next post"] },
];

export function FounderSocialGuide({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="How Launch my social media works">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">How Launch my social media works</h2>
            <p className="text-xs text-slate-500">Four short steps, about 5 minutes. Tap a step to see what happens.</p>
          </div>
          <button type="button" aria-label="Close" className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        <div className="mt-4 space-y-2">
          {PARTS.map((p, i) => (
            <div key={p.title} className="overflow-hidden rounded-lg border border-slate-200">
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-800">{i + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{p.title}</span><span className="block text-xs text-slate-500">{p.sub}</span></span>
                <span className="text-slate-400" aria-hidden="true">{open === i ? "▴" : "▾"}</span>
              </button>
              {open === i && <ol className="list-decimal space-y-1 px-3 pb-3 pl-12 text-sm text-slate-600">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900"><b>After you post:</b> tap View post under Your posts. Once it is published, View on the network opens the real post.</p>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg bg-[#1A6CE4] px-3 py-2 text-sm font-medium text-white hover:bg-[#2E78F5]">Got it</button>
      </div>
    </div>
  );
}
