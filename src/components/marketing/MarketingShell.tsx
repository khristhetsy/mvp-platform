"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";
import { MarketingSidebar } from "@/components/marketing/MarketingSidebar";

export function MarketingShell({ children }: Readonly<{ children: ReactNode }>) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="cap-marketing-surface flex min-h-screen text-[var(--navy)]">
      <div className="hidden lg:flex">
        <MarketingSidebar />
      </div>

      {mobileNavOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[var(--navy)]/30 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <MarketingSidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-[var(--shadow-panel)] backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"
                aria-label="Open menu"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <Link href="/" className="lg:hidden">
                <CapitalOSLogo height={24} />
              </Link>
            </div>
            <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
              <Link href="/deals" className="hover:text-[var(--navy)]">
                Marketplace
              </Link>
              <Link href="/founders" className="hover:text-[var(--navy)]">
                Founders
              </Link>
              <Link href="/investors" className="hover:text-[var(--navy)]">
                Investors
              </Link>
              <Link href="/pricing" className="hover:text-[var(--navy)]">
                Pricing
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-[var(--navy)] sm:inline-flex"
              >
                Login
              </Link>
              <Link href="/submit-company" className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
                Get Started
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
