"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import type { InternalPermission } from "@/lib/rbac/constants";
import type { WorkspaceId } from "@/lib/workspace-nav";
import { getWorkspaceNav, workspaceLabel } from "@/lib/workspace-nav";
import { getWorkspaceNavIcon } from "@/lib/ui/nav-icons";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";

function useAdminNavPermissions(workspace: WorkspaceId) {
  const [state, setState] = useState<{ permissions: InternalPermission[]; isSuperAdmin: boolean } | null>(null);

  useEffect(() => {
    if (workspace !== "admin") return;
    let cancelled = false;
    void fetch("/api/admin/users/permissions/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setState({
          permissions: data.permissions ?? [],
          isSuperAdmin: Boolean(data.isSuperAdmin),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ permissions: [], isSuperAdmin: false });
      });
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  return state;
}

export function WorkspaceSidebar({
  workspace,
  planBadge,
  mobileOpen = false,
  onClose,
}: Readonly<{
  workspace: WorkspaceId;
  planBadge?: ReactNode;
  mobileOpen?: boolean;
  onClose?: () => void;
}>) {
  const pathname = usePathname();
  const allItems = getWorkspaceNav(workspace);
  const adminNav = useAdminNavPermissions(workspace);
  const items = useMemo(() => {
    if (workspace !== "admin") return allItems;
    return allItems.filter((item) => {
      if (!item.requiredPermission) return true;
      if (!adminNav) return false;
      if (adminNav.isSuperAdmin) return true;
      return adminNav.permissions.includes(item.requiredPermission);
    });
  }, [allItems, adminNav, workspace]);
  const label = workspaceLabel(workspace);

  const nav = (
    <>
      <div className="border-b border-slate-200/80 bg-[var(--surface-sidebar)] px-4 py-4">
        <Link href="/" className="block" onClick={onClose}>
          <CapitalOSLogo variant="icon" height={32} />
        </Link>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = getWorkspaceNavIcon(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[var(--navy)] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-[var(--navy)]"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-slate-400"}`}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-slate-200/80 bg-[var(--surface-sidebar)] p-3">
        {planBadge ? <div>{planBadge}</div> : null}
        <div className="rounded-xl border border-slate-200/80 bg-[var(--surface-sunken)] p-3">
          <div className="flex items-start gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--navy)] text-white">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold text-[var(--navy)]">CapitalOS AI</p>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                Educational readiness coach for your workspace.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[var(--navy)]/30 lg:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200/80 bg-[var(--surface-sidebar)] shadow-[var(--shadow-panel)] transition-transform lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}
