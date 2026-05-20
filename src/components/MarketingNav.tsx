import Link from "next/link";

const navItems = [
  { href: "/deals", label: "Marketplace" },
  { href: "/founders", label: "Founders" },
  { href: "/investors", label: "Investors" },
  { href: "/login", label: "Login" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">
          IFUNDCROWD
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-slate-950">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/submit-company"
          className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Submit Company
        </Link>
      </div>
    </header>
  );
}
