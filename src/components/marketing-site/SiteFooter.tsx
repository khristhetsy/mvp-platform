import Link from "next/link";
import { Linkedin, Youtube, Instagram, type LucideIcon } from "lucide-react";
import { SiteWordmark } from "@/components/marketing-site/SiteWordmark";

/**
 * Public marketing-site footer (spec §5, §13). Server component. Content ported
 * verbatim from icapos-site-mock.html — the compliance notice is LOAD-BEARING
 * (spec §13): flag rather than reword. About → Events is a required cross-link (§3).
 */

const FOUNDERS_LINKS = [
  { href: "/start", label: "Get started" },
  { href: "/founders", label: "How it works" },
  { href: "/readiness", label: "Readiness Rating" },
  { href: "/pricing", label: "Pricing" },
];
const INVESTOR_LINKS = [
  { href: "/start", label: "Free account" },
  { href: "/investors", label: "Private Market" },
  { href: "/events", label: "Events" },
];
const COMPANY_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About us" },
  { href: "/events", label: "Events" }, // required cross-link: About → Events
  { href: "/disclosures", label: "Disclosures" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
];
const SOCIALS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "https://www.linkedin.com/company/icfocapital", label: "LinkedIn", Icon: Linkedin },
  { href: "https://www.youtube.com/@icfocapital", label: "YouTube", Icon: Youtube },
  { href: "https://www.instagram.com/icfocapital", label: "Instagram", Icon: Instagram },
];

export function SiteFooter() {
  return (
    <footer className="bg-site-navy text-white/80 font-site-body">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <SiteWordmark variant="dark" />
          <p className="mt-3 max-w-xs text-sm leading-6 text-white/60">
            Investor relations, run as software. A product of iCFO Capital Global, Inc.
          </p>
          <address className="mt-4 text-[13px] not-italic leading-6 text-white/55">
            4225 Executive Square, Suite 600-690<br />
            La Jolla, California 92037<br />
            <a href="tel:+16199569114" className="transition-colors hover:text-white">(619) 956-9114</a>
          </address>
          <div className="mt-4 flex gap-2.5">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-white/70 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
              >
                <s.Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <FooterCol title="Founders" links={FOUNDERS_LINKS} />
        <FooterCol title="Investors" links={INVESTOR_LINKS} />
        <FooterCol title="Company" links={COMPANY_LINKS} />
      </div>

      {/* COMPLIANCE NOTICE — verbatim from the mock, load-bearing (spec §13). */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="font-site-mono text-[11px] leading-5 text-white/50">
            Important compliance notice. iCFO Capital Global, Inc. is not a registered broker-dealer, funding portal,
            investment adviser, or placement agent. Nothing on this site is investment advice or an offer to sell
            securities. iCapOS does not raise capital, guarantee funding, or process transactions; all investor actions
            are non-binding indications of interest. Private investments are illiquid and carry a risk of total loss.
            Interface examples and company names shown are illustrative and fictional.
          </p>
          <p className="mt-4 text-[11px] text-white/40">© 2026 iCFO Capital Global, Inc. · La Jolla, California</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-site-mono text-xs font-medium uppercase tracking-wider text-site-blue-lt">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-white/70 transition-colors hover:text-white">{l.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
