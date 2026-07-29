"use client";

import { useState, type ReactNode } from "react";

/**
 * Tabbed shell for the founder Profile page: the profile/company form under
 * "Profile", and the public one-pager preview under "One pager" (renamed from
 * "Investor one-pager"). Server-rendered content is passed in as props so the
 * RSC boundary stays clean.
 */
export function FounderProfileTabs({
  profileTab,
  onePagerTab,
}: {
  profileTab: ReactNode;
  onePagerTab: ReactNode;
}) {
  const [tab, setTab] = useState<"profile" | "onepager">("profile");
  const tabs: { key: "profile" | "onepager"; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "onepager", label: "One pager" },
  ];

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "profile" ? profileTab : onePagerTab}
    </div>
  );
}
