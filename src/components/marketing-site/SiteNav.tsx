"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SiteWordmark } from "@/components/marketing-site/SiteWordmark";

/**
 * Public marketing-site top nav (spec §3). Client component for the dropdowns +
 * active-state. Structure is fixed:
 *   Home · Founders ▾ · Investors · Events · About ▾
 *   Founders ▾ : How it works · Readiness Rating · Pricing  (Pricing lives here only)
 *   About ▾    : About us · Disclosures
 *   Right side : AI Mode · Sign in · Get started
 * AI Mode opens the full-screen AI-first surface (icapos:open-ai-first).
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

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState<"founders" | "about" | null>(null);

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));
  const linkClass = (href: string) =>
    `px-3 py-2 text-sm font-medium transition-colors hover:text-site-blue-hi ${isActive(href) ? "text-site-blue-hi" : "text-site-ink"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-site-line bg-white/90 backdrop-blur font-site-body">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-6" aria-label="Primary">
        <Link href="/" className="mr-4" aria-current={pathname === "/" ? "page" : undefined}>
          <SiteWordmark variant="light" />
        </Link>

        <div className="hidden items-center md:flex">
          <Link href="/" className={linkClass("/")} aria-current={pathname === "/" ? "page" : undefined}>Home</Link>

          <Dropdown
            label="Founders"
            href="/founders"
            isOpen={open === "founders"}
            onToggle={() => setOpen(open === "founders" ? null : "founders")}
            onClose={() => setOpen(null)}
            items={FOUNDERS}
            active={FOUNDERS.some((i) => isActive(i.href))}
          />

          <Link href="/investors" className={linkClass("/investors")} aria-current={isActive("/investors") ? "page" : undefined}>Investors</Link>
          <Link href="/events" className={linkClass("/events")} aria-current={isActive("/events") ? "page" : undefined}>Events</Link>

          <Dropdown
            label="About"
            href="/about"
            isOpen={open === "about"}
            onToggle={() => setOpen(open === "about" ? null : "about")}
            onClose={() => setOpen(null)}
            items={ABOUT}
            active={ABOUT.some((i) => isActive(i.href))}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Real anchor (crawlable, valid href) — opens the overlay in place with
              JS; without JS it navigates to "/", where AI Mode opens by default. */}
          <Link
            href="/"
            onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("icapos:open-ai-first")); }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-site-ink transition-colors hover:text-site-blue-hi"
          >
            AI Mode
          </Link>
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
  href,
  items,
  isOpen,
  onToggle,
  onClose,
  active,
}: {
  label: string;
  href: string;
  items: Item[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  active: boolean;
}) {
  return (
    <div className="relative flex items-center">
      {/* Parent is a real crawlable link to the landing page (brief Step 7); the
          caret is a separate toggle for the submenu. */}
      <Link href={href} className={`px-3 py-2 text-sm font-medium transition-colors hover:text-site-blue-hi ${active ? "text-site-blue-hi" : "text-site-ink"}`}>{label}</Link>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${label} menu`}
        className={`-ml-1 rounded p-1 transition-colors hover:text-site-blue-hi ${active ? "text-site-blue-hi" : "text-site-ink"}`}
      >
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
