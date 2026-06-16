"use client";

import Link from "next/link";

type SettingsTab = "company" | "billing" | "integrations" | "feedback";

const SETTINGS_NAV: { key: SettingsTab; label: string; icon: string; href: string; sub: string }[] = [
  { key: "company",      label: "Company profile",      icon: "🏢", href: "/founder/settings",              sub: "Listing, branding & details" },
  { key: "billing",      label: "Billing & subscription", icon: "💳", href: "/founder/settings/billing",    sub: "Plan, payment & usage" },
  { key: "integrations", label: "Integrations",          icon: "🔗", href: "/founder/settings/integrations", sub: "Connected accounts & tools" },
  { key: "feedback",     label: "Feedback",              icon: "💬", href: "/founder/settings/feedback",     sub: "Help us improve CapitalOS" },
];

export function SettingsSidebarNav({ active }: { active: SettingsTab }) {
  return (
    <nav className="hidden w-52 shrink-0 lg:block">
      <div className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Settings</p>
        </div>
        <ul className="py-1">
          {SETTINGS_NAV.map((item) => {
            const isActive = item.key === active;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="mt-0.5 text-base leading-none">{item.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium leading-tight ${isActive ? "text-indigo-700" : "text-slate-800"}`}>
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{item.sub}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
