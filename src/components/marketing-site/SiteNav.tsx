"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * Public marketing-site top nav (spec §3). Client component for the dropdowns +
 * active-state. Structure is fixed:
 *   Home · Founders ▾ · Investors · Pricing · Events · About ▾
 *   Founders ▾ : How it works · Readiness Rating · Pricing
 *   About ▾    : About us · Disclosures
 *   Right side : Ask AI · Sign in · Get started
 * Readiness Rating stays under Founders (§3) — do not move to About.
 *
 * Logo: the real vector lockup is a known launch gap (§4, §17). This renders a
 * text lockup placeholder; swap in the knockout/full-colour SVGs when available.
 */

type Item = { href: string; label: string };

const FOUNDERS: Item[] = [
  { href: "/founders", label: "How it works" },
  { href: "/readiness", label: "Readiness Rating" },
  { href: "/pricing", label: "Pricing" },
];
const ABOUT: Item[] = [
  { href: "/about", label: "About us" },
  { href: "/disclosures", label: "Disclosures" },
];

export function SiteNav({ onAskAi }: { onAskAi?: () => void }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState<"founders" | "about" | null>(null);

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));
  const linkClass = (href: string) =>
    `px-3 py-2 text-sm font-medium transition-colors hover:text-site-blue-hi ${isActive(href) ? "text-site-blue-hi" : "text-site-ink"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-site-line bg-white/90 backdrop-blur font-site-body">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-6" aria-label="Primary">
        <Link href="/" className="mr-4 font-site-display text-lg font-extrabold tracking-tight text-site-navy" aria-current={pathname === "/" ? "page" : undefined}>
          iCap<span className="text-site-blue-hi">OS</span>
        </Link>

        <div className="hidden items-center md:flex">
          <Link href="/" className={linkClass("/")} aria-current={pathname === "/" ? "page" : undefined}>Home</Link>

          <Dropdown
            label="Founders"
            isOpen={open === "founders"}
            onToggle={() => setOpen(open === "founders" ? null : "founders")}
            onClose={() => setOpen(null)}
            items={FOUNDERS}
            active={FOUNDERS.some((i) => isActive(i.href))}
          />

          <Link href="/investors" className={linkClass("/investors")} aria-current={isActive("/investors") ? "page" : undefined}>Investors</Link>
          <Link href="/pricing" className={linkClass("/pricing")} aria-current={isActive("/pricing") ? "page" : undefined}>Pricing</Link>
          <Link href="/events" className={linkClass("/events")} aria-current={isActive("/events") ? "page" : undefined}>Events</Link>

          <Dropdown
            label="About"
            isOpen={open === "about"}
            onToggle={() => setOpen(open === "about" ? null : "about")}
            onClose={() => setOpen(null)}
            items={ABOUT}
            active={ABOUT.some((i) => isActive(i.href))}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (onAskAi) onAskAi();
              else if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("icapos:open-assistant"));
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-site-ink transition-colors hover:text-site-blue-hi"
          >
            Ask AI
          </button>
          <Link href="/auth/sign-in" className="rounded-lg px-3 py-2 text-sm font-medium text-site-ink transition-colors hover:text-site-blue-hi">
            Sign in
          </Link>
          <Link
            href="/start"
            className="rounded-lg bg-site-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Dropdown({
  label,
  items,
  isOpen,
  onToggle,
  onClose,
  active,
}: {
  label: string;
  items: Item[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  active: boolean;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors hover:text-site-blue-hi ${active ? "text-site-blue-hi" : "text-site-ink"}`}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {isOpen ? (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden="true" />
          <ul role="menu" className="absolute left-0 top-full z-20 mt-1 min-w-48 rounded-xl border border-site-line bg-white py-1.5 shadow-lg">
            {items.map((i) => (
              <li key={i.href} role="none">
                <Link role="menuitem" href={i.href} onClick={onClose} className="block px-4 py-2 text-sm text-site-ink transition-colors hover:bg-site-blue-pale hover:text-site-blue-hi">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
