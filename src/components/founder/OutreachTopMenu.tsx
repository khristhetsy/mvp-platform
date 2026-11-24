"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ITEMS = [
  { id: "profile", href: "/founder/deploy", label: "Public Profile" },
  { id: "automated", href: "/founder/deploy?step=outreach&mode=automated", label: "Outreach: Automated" },
  { id: "manual", href: "/founder/deploy?step=outreach&mode=manual", label: "Outreach: Manual" },
  { id: "social", href: "/founder/deploy/social", label: "Social media" },
] as const;

/** Top-of-page menu for the Outreach pages: the same four links as the sidebar's Outreach group. */
export function OutreachTopMenu() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const step = sp?.get("step");
  const mode = sp?.get("mode");

  function isActive(id: (typeof ITEMS)[number]["id"]) {
    if (id === "social") return pathname.startsWith("/founder/deploy/social");
    if (pathname !== "/founder/deploy") return false;
    if (id === "profile") return (!step || step === "profile") && !mode;
    return step === "outreach" && mode === id;
  }

  return (
    <nav aria-label="Outreach" className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
      {ITEMS.map((item) => {
        const active = isActive(item.id);
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-3 text-sm transition-colors ${
              active
                ? "border-[var(--blue)] font-semibold text-[var(--blue-hover)]"
                : "border-transparent text-slate-600 hover:text-[var(--blue-hover)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
