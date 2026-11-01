"use client";

const STEPS: { title: string; where: string; body: string; check: string }[] = [
  {
    title: "Run and approve the site audit",
    where: "Overview tab",
    body: "Open Overview and tap Run audit now on the Site audit card. Read the five findings. If Claims shows Review, check the wording on your site: a disclaimer such as \"no guarantee\" is fine. Tap Approve findings.",
    check: "The badge changes from Proposed to Approved. Run it again after any big site change.",
  },
  {
    title: "Add your signal phrases",
    where: "Finder, Signals",
    body: "Type a phrase founders really use, such as \"raising a seed round\", and tap Add. Add three to five. Remove one with the x on its chip.",
    check: "Each phrase shows as a chip. Phrases help rate a conversation as Strong or Good.",
  },
  {
    title: "Find conversations yourself",
    where: "Reddit, LinkedIn, X",
    body: "Search each platform for your phrases. Pick posts where a founder asks a real question. Copy the link and one or two lines of what they wrote. The finder does not search for you yet.",
    check: "You have a link and a line of text for each conversation.",
  },
  {
    title: "Save the conversation",
    where: "Finder, Add a conversation",
    body: "Paste the link and the text. Leave the dropdown on Detect who is talking unless you know better. Tap Save conversation.",
    check: "A card shows Strong, Good or Staff review. An investor shows Held, no public reply.",
  },
  {
    title: "Reply to a founder",
    where: "Reddit reply, then post",
    body: "Reddit: tap Open in Reddit reply, check the link and template, pick a campaign, tap Get tracked link, then Copy reply. Post it on Reddit from your own account, then tap Mark as posted. LinkedIn or X: reply on the platform yourself, then tap Mark replied on the card.",
    check: "The card shows Replied. Clicks on the tracked link appear in Attribution.",
  },
  {
    title: "Handle an investor",
    where: "Held cards",
    body: "Do not reply in public. Go through your approval gate for any investor contact. When it is handled, tap Dismiss.",
    check: "The card shows Skipped.",
  },
  {
    title: "Review results each week",
    where: "Attribution tab",
    body: "Open Attribution and read clicks and meetings by channel. In Finder, count the Replied cards. Run the pilot for two weeks on your own accounts and keep volume low on new accounts.",
    check: "No targets yet. The first two weeks set your baseline.",
  },
];

/** How to use the Finder and Site audit. Opens from the How to use button on the Finder tab. */
export function FinderGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="How to use the Finder and Site audit">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">How to use the Finder and Site audit</h2>
            <p className="text-xs text-slate-500">Seven steps. Nothing posts by itself.</p>
          </div>
          <button type="button" aria-label="Close" className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        <ol className="mt-4 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-800">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold text-slate-900">{s.title}</span>
                  <span className="text-[11px] text-slate-400">{s.where}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">{s.body}</p>
                <p className="mt-1 rounded-md bg-emerald-50 px-2 py-1 text-[12px] text-emerald-800">You should see: {s.check}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          <span className="font-semibold">Rules for every reply:</span> answer the question first, keep links to a minority of replies, never promise returns, funding or outcomes. The disclaimer is added automatically. A person approves each reply before it is posted.
        </div>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-[#1A6CE4] px-3 py-2 text-sm font-medium text-white hover:bg-[#2E78F5]">Got it</button>
      </div>
    </div>
  );
}
