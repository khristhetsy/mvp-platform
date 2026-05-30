"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { compactDisclaimer } from "@/lib/compliance";
import type { Role } from "@/lib/auth";
import type { WorkspaceId } from "@/lib/workspace-nav";
import { resolveWorkspaceFromPath, workspaceShellRole } from "@/lib/workspace-nav";

const AppShellContext = createContext(false);

const platformNavItems: { href: string; label: string; roles: Role[] }[] = [
  { href: "/founder/dashboard", label: "Founder", roles: ["FOUNDER", "ADMIN", "ANALYST"] },
  { href: "/deals", label: "Marketplace", roles: ["INVESTOR", "ADMIN", "ANALYST"] },
  { href: "/investor/dashboard", label: "Investor", roles: ["INVESTOR", "ADMIN", "ANALYST"] },
  { href: "/admin/dashboard", label: "Admin", roles: ["ADMIN", "ANALYST"] },
];

export function AppShell({
  children,
  role = "FOUNDER",
  workspace,
  profileName = "CapitalOS User",
  profileSubtitle,
  planBadge,
}: Readonly<{
  children: React.ReactNode;
  role?: Role;
  workspace?: WorkspaceId;
  profileName?: string;
  profileSubtitle?: string;
  planBadge?: React.ReactNode;
}>) {
  const insideAppShell = useContext(AppShellContext);
  const pathname = usePathname();
  const activeWorkspace = workspace ?? resolveWorkspaceFromPath(pathname ?? "");
  const shellRole = activeWorkspace ? workspaceShellRole(activeWorkspace) : role;

  if (insideAppShell && activeWorkspace) {
    return (
      <>
        <WorkspaceHeader profileName={profileName} profileSubtitle={profileSubtitle} />
        <main className="flex-1 overflow-y-auto bg-slate-50/80 p-6 lg:p-8">{children}</main>
      </>
    );
  }

  if (activeWorkspace) {
    return (
      <AppShellContext.Provider value={true}>
        <div className="flex min-h-screen w-full flex-1 bg-slate-100 text-slate-950">
          <WorkspaceSidebar workspace={activeWorkspace} planBadge={planBadge} />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </AppShellContext.Provider>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold tracking-tight text-slate-950">
            CapitalOS
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-slate-600 md:flex">
            {platformNavItems
              .filter((item) => item.roles.includes(shellRole))
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
