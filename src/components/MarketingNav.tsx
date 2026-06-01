"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";

export const marketingNavItems = [
  { href: "/", label: "Overview" },
  { href: "/deals", label: "Marketplace" },
  { href: "/founders", label: "Founders" },
  { href: "/investors", label: "Investors" },
  { href: "/pricing", label: "Pricing" },
  { href: "/submit-company", label: "Submit Company" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MarketingNav() {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-[var(--shadow-panel)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center" onClick={() => setMobileOpen(false)}>
          <CapitalOSLogo height={32} className="md:hidden" />
          <CapitalOSLogo height={28} className="hidden md:block" priority />
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 lg:flex" aria-label="Primary">
          {marketingNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`transition hover:text-[var(--navy)] ${isActive(pathname, item.href) ? "font-semibold text-[var(--navy)]" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/auth/sign-in"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-[var(--navy)]"
          >
            Sign In
          </Link>
          <Link href="/submit-company" className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
        </button>
      </div>

      {mobileOpen ? (
        <nav
          className="border-t border-slate-200/80 bg-white px-4 py-3 lg:hidden"
          aria-label="Mobile primary"
        >
          <ul className="space-y-1">
            {marketingNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive(pathname, item.href)
                      ? "bg-[var(--navy-muted)] text-[var(--navy)]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[var(--navy)]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
            <Link
              href="/auth/sign-in"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-700"
            >
              Sign In
            </Link>
            <Link
              href="/submit-company"
              onClick={() => setMobileOpen(false)}
              className="cap-btn-primary rounded-lg px-3 py-2.5 text-center text-sm font-semibold"
            >
              Get Started
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
