"use client";

import Link from "next/link";

type Tab = "profile" | "integrations" | "feedback";

const TABS: { key: Tab; label: string; icon: () => React.ReactElement }[] = [
  {
    key: "profile",
    label: "Investor profile",
    icon: () => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: "integrations",
    label: "Integrations",
    icon: () => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    key: "feedback",
    label: "Feedback",
    icon: () => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export function InvestorSettingsNav({ active }: { active: Tab }) {
  return (
    <nav className="mb-6 flex gap-0 overflow-x-auto border-b border-slate-200 [-webkit-overflow-scrolling:touch]">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        const href = key === "profile" ? "/investor/settings" : `/investor/settings?tab=${key}`;
        return (
          <Link
            key={key}
            href={href}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
