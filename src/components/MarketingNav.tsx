import Link from "next/link";

const navItems = [
  { href: "/deals", label: "Marketplace" },
  { href: "/pricing", label: "Pricing" },
  { href: "/founders", label: "Founders" },
  { href: "/investors", label: "Investors" },
  { href: "/login", label: "Login" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-[var(--shadow-panel)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
            C
          </span>
          CapitalOS
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-indigo-600">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/submit-company" className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
          Submit Company
        </Link>
      </div>
    </header>
  );
}
