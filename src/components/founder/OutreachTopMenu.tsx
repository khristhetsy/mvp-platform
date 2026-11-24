"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ItemId = "profile" | "automated" | "manual" | "social" | "analytics" | "settings";

const TABS: ReadonlyArray<{ id: ItemId; href: string; label: string }> = [
  { id: "profile", href: "/founder/deploy", label: "Public Profile" },
  { id: "automated", href: "/founder/deploy?step=outreach&mode=automated", label: "Outreach: Automated" },
  { id: "manual", href: "/founder/deploy?step=outreach&mode=manual", label: "Outreach: Manual" },
  { id: "social", href: "/founder/deploy/social", label: "Outreach: Social media" },
];

/** Analytics and Settings sit inside the More menu. */
const MORE: ReadonlyArray<{ id: ItemId; href: string; label: string }> = [
  { id: "analytics", href: "/founder/deploy?step=analytics", label: "Analytics" },
  { id: "settings", href: "/founder/deploy?step=settings", label: "Settings" },
];

/** Top-of-page menu for the Outreach pages: the same links as the sidebar, with Analytics and Settings under More. */
export function OutreachTopMenu() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const step = sp?.get("step");
  const mode = sp?.get("mode");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  function isActive(id: ItemId) {
    if (id === "social") return pathname.startsWith("/founder/deploy/social");
    if (pathname !== "/founder/deploy") return false;
    if (id === "profile") return (!step || step === "profile") && !mode;
    if (id === "analytics" || id === "settings") return step === id;
    return step === "outreach" && mode === id;
  }

  const moreActive = MORE.some((m) => isActive(m.id));

  // Close the menu on a click outside it, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tabCls = (active: boolean) =>
    `-mb-px border-b-2 px-4 py-3 text-sm transition-colors ${
      active
        ? "border-[var(--blue)] font-semibold text-[var(--blue-hover)]"
        : "border-transparent text-slate-600 hover:text-[var(--blue-hover)]"
    }`;

  return (
    <nav aria-label="Outreach" className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.map((item) => {
        const active = isActive(item.id);
        return (
          <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={tabCls(active)}>
            {item.label}
          </Link>
        );
      })}
      <div ref={boxRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={tabCls(moreActive)}
        >
          More <span aria-hidden="true">▾</span>
        </button>
        {open ? (
          <div role="menu" className="absolute left-0 top-full z-20 mt-1 min-w-[10.5rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[var(--shadow-panel)]">
            {MORE.map((item) => {
              const active = isActive(item.id);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-[var(--blue-muted)] font-semibold text-[var(--blue-hover)]" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
