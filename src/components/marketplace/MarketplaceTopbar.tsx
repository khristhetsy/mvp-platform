import Link from "next/link";
import { marketplaceCopy } from "@/lib/marketplace/copy";

// Public marketplace topbar. (Follow-up: reconcile with the shared public-site
// nav component once its API is settled; kept self-contained here to match the
// approved mockup exactly.)
export function MarketplaceTopbar() {
  return (
    <header className="flex items-center justify-between bg-[linear-gradient(90deg,#0A1A40_0%,#12408F_60%,#1A6CE4_100%)] px-8 py-3.5 text-white">
      <Link href="/" className="flex items-center gap-2.5">
        <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="17" stroke="#FFFFFF" strokeOpacity=".9" strokeWidth="2.6" />
          <rect x="12" y="21" width="4" height="7" rx="1.2" fill="#FFFFFF" />
          <rect x="18" y="17" width="4" height="11" rx="1.2" fill="#FFFFFF" />
          <rect x="24" y="12" width="4" height="16" rx="1.2" fill="#FFFFFF" />
        </svg>
        <span className="text-[17px] font-semibold">iCapOS</span>
      </Link>
      <nav className="hidden gap-[22px] text-[13.5px] md:flex" aria-label="Primary">
        {marketplaceCopy.nav.links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className={
              "active" in l && l.active
                ? "border-b-2 border-white pb-0.5 font-semibold text-white"
                : "text-white/85 hover:text-white"
            }
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
