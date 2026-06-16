"use client";

import Link from "next/link";

type SettingsTab = "company" | "billing" | "integrations" | "feedback";

function IcoBuildingOffice() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="1" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IcoCreditCard() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function IcoLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IcoMessageSquare() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const SETTINGS_NAV = [
  { key: "company" as SettingsTab,      label: "Company profile",       icon: IcoBuildingOffice, href: "/founder/settings"               },
  { key: "billing" as SettingsTab,      label: "Billing & subscription", icon: IcoCreditCard,    href: "/founder/settings/billing"       },
  { key: "integrations" as SettingsTab, label: "Integrations",           icon: IcoLink,          href: "/founder/settings/integrations"  },
  { key: "feedback" as SettingsTab,     label: "Feedback",               icon: IcoMessageSquare, href: "/founder/settings/feedback"      },
];

export function SettingsSidebarNav({ active }: { active: SettingsTab }) {
  return (
    <nav className="mb-6 flex gap-0 border-b border-slate-200">
      {SETTINGS_NAV.map((item) => {
        const isActive = item.key === active;
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
