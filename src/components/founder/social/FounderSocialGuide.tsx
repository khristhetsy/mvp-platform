"use client";

const STEPS: { title: string; body: string }[] = [
  { title: "Open Social media", body: "Open Stage 3 Marketing, then Outreach, then the Social media tab." },
  { title: "Connect an account", body: "Open Settings and tap Connect next to LinkedIn, Facebook, Instagram or Reddit." },
  { title: "Approve access", body: "Sign in on the network, tap Allow, and you come back connected." },
  { title: "Create a campaign", body: "Open Campaigns and goals, tap New campaign, name it and save." },
  { title: "Write with the AI agent", body: "Open Compose, jot a few notes, tap a template, then edit the draft in your own words." },
  { title: "Schedule the post", body: "Pick a date and time in PT, choose the campaign, tap Schedule. The counter shows how many posts you have left." },
  { title: "Check your results", body: "Overview shows your funnel. Attribution shows which post led to a click and a meeting." },
];

export function FounderSocialGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="How to use Social media">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">How to use Social media</h2>
            <p className="text-xs text-slate-500">Seven steps, about 5 minutes.</p>
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
