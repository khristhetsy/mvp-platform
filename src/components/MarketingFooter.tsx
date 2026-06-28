import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-8 text-sm text-slate-500 md:flex-row md:items-center">
        <div>
          <p className="font-semibold text-[var(--navy)]">iCapOS</p>
          <p className="mt-1">The operating system for capital-ready companies.</p>
          <p className="mt-0.5 text-xs text-slate-400">Capital readiness and private market infrastructure.</p>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link href="/deals" className="hover:text-slate-950">
            Marketplace
          </Link>
          <Link href="/founders" className="hover:text-slate-950">
            Founders
          </Link>
          <Link href="/investors" className="hover:text-slate-950">
            Investors
          </Link>
          <Link href="/auth/sign-in" className="hover:text-slate-950">
            Login
          </Link>
          <Link href="/privacy" className="hover:text-slate-950">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-slate-950">
            Terms
          </Link>
          <Link href="/security" className="hover:text-slate-950">
            Security
          </Link>
        </div>
      </div>
    </footer>
  );
}
