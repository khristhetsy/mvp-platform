"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogIn,
  Rocket,
  Store,
  Users,
} from "lucide-react";
import { IcapOSLogo } from "@/components/IcapOSLogo";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/deals", label: "Marketplace", icon: Store },
  { href: "/founders", label: "Founders", icon: Rocket },
  { href: "/investors", label: "Investors", icon: Users },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  { href: "/submit-company", label: "Submit Company", icon: Building2 },
];

export function MarketingSidebar({ onNavigate }: Readonly<{ onNavigate?: () => void }>) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white">
      <div className="border-b border-slate-200/80 px-4 py-4">
        <Link href="/" className="block" onClick={onNavigate}>
          <IcapOSLogo height={32} priority />
        </Link>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Institutional platform
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[var(--navy)] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-[var(--navy)]"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-slate-400"}`} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200/80 p-3">
        <Link
          href="/login"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100"
        >
          <LogIn className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
          Sign in
        </Link>
      </div>
    </aside>
  );
}
