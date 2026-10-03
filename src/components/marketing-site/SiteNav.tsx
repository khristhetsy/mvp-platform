"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { SiteWordmark } from "@/components/marketing-site/SiteWordmark";
import { useSiteViewer, type SiteViewer } from "@/components/marketing-site/useSiteViewer";

/**
 * Public marketing-site top nav (spec §3). Client component for the dropdowns +
 * active-state. Structure is fixed:
 *   Home · Founders ▾ · Investors · Events · About ▾
 *   Founders ▾ : How it works · Readiness Rating · Pricing  (Pricing lives here only)
 *   About ▾    : About us · Disclosures
 *   Right side : AI Mode · Sign in · Get started   (signed out)
 *                AI Mode · Dashboard · avatar menu (signed in)
 * The session is read in the browser (useSiteViewer) so public pages stay
 * cacheable; while it loads the right side reserves space instead of flashing
 * "Sign in" at a signed-in visitor.
 * AI Mode opens the full-screen AI-first surface (icapos:open-ai-first). On pages
 * that don't mount it (events, deals, sign in) the link goes to "/?ai=1" instead.
 * Below md the links move into a menu button so phones can reach every page.
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [viewer, setViewer] = useSiteViewer();
  const router = useRouter();

  const signOut = async () => {
    setMobileOpen(false);
    try {
      await fetch("/auth/logout", { method: "POST" });
    } finally {
      setViewer({ status: "signed-out" });
      router.push("/");
      router.refresh();
    }
  };

  // Open the overlay in place when this page mounts it; otherwise follow the link
  // to "/?ai=1", which opens it on the home page.
  const openAiMode = (e: MouseEvent) => {
    setMobileOpen(false);
    if ((window as unknown as { __icaposAiFirst?: boolean }).__icaposAiFirst) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("icapos:open-ai-first"));
    }
  };

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
            href="/?ai=1"
            onClick={openAiMode}
            className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-site-ink transition-colors hover:text-site-blue-hi md:inline-flex"
          >
            AI Mode
          </Link>
          {viewer.status === "signed-in" ? (
            <>
              <Link
                href={viewer.dashboardHref}
                className="whitespace-nowrap rounded-lg border border-site-line px-3 py-2 text-sm font-medium text-site-ink transition-colors hover:border-site-blue-hi hover:text-site-blue-hi"
              >
                Dashboard
              </Link>
              <AccountMenu viewer={viewer} onSignOut={signOut} />
            </>
          ) : viewer.status === "signed-out" ? (
            <>
              <Link href="/auth/sign-in" className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-site-ink transition-colors hover:text-site-blue-hi sm:inline-flex">
                Sign in
              </Link>
              <Link
                href="/start"
                className="whitespace-nowrap rounded-lg bg-site-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-site-blue-hi"
              >
                Get started
              </Link>
            </>
          ) : (
            <span className="inline-block h-9 w-28 sm:w-44" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="rounded-lg p-2 text-site-ink transition-colors hover:text-site-blue-hi md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {mobileOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {mobileOpen ? (
        <div id="site-mobile-menu" className="border-t border-site-line bg-white md:hidden">
          <ul className="mx-auto max-w-6xl px-6 py-3">
            {[
              { href: "/", label: "Home" },
              ...FOUNDERS.map((i) => ({ ...i, label: i.href === "/founders" ? "Founders" : i.label, indent: i.href !== "/founders" })),
              { href: "/investors", label: "Investors" },
              { href: "/events", label: "Events" },
              ...ABOUT.map((i) => ({ ...i, label: i.href === "/about" ? "About" : i.label, indent: i.href !== "/about" })),
              ...(viewer.status === "signed-in"
                ? [{ href: viewer.dashboardHref, label: "Dashboard" }]
                : viewer.status === "signed-out"
                  ? [{ href: "/auth/sign-in", label: "Sign in" }]
                  : []),
            ].map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={pathname === i.href ? "page" : undefined}
                  className={`block rounded-lg py-2.5 text-[15px] font-medium transition-colors hover:text-site-blue-hi ${"indent" in i && i.indent ? "pl-4 text-site-ink/80" : "text-site-ink"} ${pathname === i.href ? "text-site-blue-hi" : ""}`}
                >
                  {i.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/?ai=1" onClick={openAiMode} className="block rounded-lg py-2.5 text-[15px] font-medium text-site-blue-hi">
                AI Mode
              </Link>
            </li>
            {viewer.status === "signed-in" ? (
              <li className="mt-2 border-t border-site-line pt-3">
                <p className="truncate text-sm text-site-ink/70">Signed in as {viewer.email}</p>
                <button type="button" onClick={signOut} className="mt-1 block w-full rounded-lg py-2.5 text-left text-[15px] font-medium text-site-ink transition-colors hover:text-site-blue-hi">
                  Log out
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
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

function AccountMenu({
  viewer,
  onSignOut,
}: {
  viewer: Extract<SiteViewer, { status: "signed-in" }>;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${viewer.name}`}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm font-medium text-site-ink transition-colors hover:text-site-blue-hi"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-site-blue-pale text-xs font-semibold text-site-blue-hi">
          {viewer.initials}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-site-line bg-white py-1.5 shadow-lg">
            <div className="border-b border-site-line px-4 pb-2.5 pt-1.5">
              <p className="truncate text-sm font-semibold text-site-ink">{viewer.name}</p>
              <p className="truncate text-xs text-site-ink/70">{viewer.email}</p>
            </div>
            <Link role="menuitem" href={viewer.dashboardHref} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-site-ink transition-colors hover:bg-site-blue-pale hover:text-site-blue-hi">
              Dashboard
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="block w-full px-4 py-2 text-left text-sm text-site-ink transition-colors hover:bg-site-blue-pale hover:text-site-blue-hi"
            >
              Log out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
