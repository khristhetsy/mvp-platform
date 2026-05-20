import Link from "next/link";
import { compactDisclaimer } from "@/lib/compliance";
import type { Role } from "@/lib/auth";

const navItems: { href: string; label: string; roles: Role[] }[] = [
  { href: "/founder/dashboard", label: "Founder", roles: ["FOUNDER", "ADMIN", "ANALYST"] },
  { href: "/deals", label: "Deals", roles: ["INVESTOR", "ADMIN", "ANALYST"] },
  { href: "/investor/dashboard", label: "Investor", roles: ["INVESTOR", "ADMIN", "ANALYST"] },
  { href: "/admin/dashboard", label: "Admin", roles: ["ADMIN", "ANALYST"] },
];

export function AppShell({
  children,
  role = "FOUNDER",
}: Readonly<{
  children: React.ReactNode;
  role?: Role;
}>) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold tracking-tight text-slate-950">
            DiligenceVault
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-slate-600 md:flex">
            {navItems
              .filter((item) => item.roles.includes(role))
              .map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-slate-950">
                  {item.label}
                </Link>
              ))}
          </nav>
          <Link
            href="/auth/sign-in"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-950"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5 text-xs text-slate-500">{compactDisclaimer()}</div>
      </footer>
    </div>
  );
}
