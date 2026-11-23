"use client";

const STEPS: { title: string; body: string }[] = [
  { title: "Open Social media", body: "Open Stage 3 Marketing, then Outreach, then Social media. You land on Launch my social media." },
  { title: "Connect an account", body: "Tap Connect, pick LinkedIn, Facebook, Instagram or Reddit, tap Approve, then check the account." },
  { title: "Create a campaign", body: "Tap Create, name the campaign, set optional monthly goals and alerts, then review." },
  { title: "Write a post", body: "Tap Write. Pick a topic, edit the draft, choose networks, pick a time in PT, then review and schedule." },
  { title: "View your post", body: "Under Your posts, tap View post. Once it is published, View on the network opens the real post." },
  { title: "Do the weekly review", body: "Tap Review to see your funnel, your weakest step and what worked, then write the next post." },
];

export function FounderSocialGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="How to use Social media">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">How to use Social media</h2>
            <p className="text-xs text-slate-500">Six steps, about 5 minutes.</p>
          </div>
          <button type="button" aria-label="Close" className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        <ol className="mt-4 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-800">{i + 1}</span>
              <div><div className="text-sm font-semibold text-slate-900">{s.title}</div><p className="text-sm text-slate-600">{s.body}</p></div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-[#1A6CE4] px-3 py-2 text-sm font-medium text-white hover:bg-[#2E78F5]">Got it</button>
      </div>
    </div>
  );
}
