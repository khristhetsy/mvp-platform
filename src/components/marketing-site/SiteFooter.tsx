import Link from "next/link";

/**
 * Public marketing-site footer (spec §5, §13). Server component.
 *
 * The compliance notice text is LOAD-BEARING (spec §13) — port verbatim, flag
 * rather than reword. The About → Events link is a required cross-link (§3).
 */

const FOUNDERS_LINKS = [
  { href: "/founders", label: "How it works" },
  { href: "/readiness", label: "Readiness Rating" },
  { href: "/pricing", label: "Pricing" },
];
const COMPANY_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/events", label: "Events" }, // required cross-link: About → Events
  { href: "/disclosures", label: "Disclosures" },
];
const PRODUCT_LINKS = [
  { href: "/investors", label: "For investors" },
  { href: "/pricing", label: "Pricing" },
  { href: "/start", label: "Get started" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-site-navy text-white/80 font-site-body">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="font-site-display text-lg font-extrabold tracking-tight text-white">
            iCapOS
          </div>
          <p className="mt-3 max-w-xs text-sm leading-6 text-white/60">
            The capital-readiness operating system. A product of iCFO Capital Global, Inc.
          </p>
        </div>

        <nav aria-label="Founders">
          <h2 className="font-site-mono text-xs font-medium uppercase tracking-wider text-site-blue-lt">Founders</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {FOUNDERS_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-white/70 transition-colors hover:text-white">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Product">
          <h2 className="font-site-mono text-xs font-medium uppercase tracking-wider text-site-blue-lt">Product</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {PRODUCT_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-white/70 transition-colors hover:text-white">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="font-site-mono text-xs font-medium uppercase tracking-wider text-site-blue-lt">Company</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {COMPANY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-white/70 transition-colors hover:text-white">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* COMPLIANCE NOTICE — load-bearing (spec §13). Do not reword without counsel. */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="font-site-mono text-[11px] leading-5 text-white/50">
            iCFO Capital Global, Inc. is not a broker-dealer, funding portal, investment adviser, or placement
            agent. Nothing on this site is investment advice or an offer to sell securities. No capital is raised, no
            funding is guaranteed, and no transactions are processed through iCapOS. All investor actions are
            non-binding indications of interest. Private investments are illiquid and carry the risk of total loss.
          </p>
          <p className="mt-4 text-[11px] text-white/40">
            © {year} iCFO Capital Global, Inc. All rights reserved. iCapOS is a product of iCFO Capital Global, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
