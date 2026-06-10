"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import type { InternalPermission } from "@/lib/rbac/constants";
import type { WorkspaceId, WorkspaceNavItem } from "@/lib/workspace-nav";
import { getAdminWorkspaceNavSections, getWorkspaceNav, workspaceLabel } from "@/lib/workspace-nav";
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
        if (cancelled) return;
        if (!data) {
          setState({ permissions: [], isSuperAdmin: false });
          return;
        }
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
  const adminNav = useAdminNavPermissions(workspace);
  const canShowNavItem = useMemo(() => {
    return (item: WorkspaceNavItem) => {
      if (workspace !== "admin") return true;
      if (!item.requiredPermission) return true;
      if (!adminNav) return false;
      if (adminNav.isSuperAdmin) return true;
      return adminNav.permissions.includes(item.requiredPermission);
    };
  }, [adminNav, workspace]);

  const items = useMemo(() => {
    return getWorkspaceNav(workspace).filter(canShowNavItem);
  }, [canShowNavItem, workspace]);

  const adminSections = useMemo(() => {
    if (workspace !== "admin") return null;
    return getAdminWorkspaceNavSections()
      .map((section) => ({
        ...section,
        items: section.items.filter(canShowNavItem),
      }))
      .filter((section) => section.items.length > 0);
  }, [canShowNavItem, workspace]);

  const label = workspaceLabel(workspace);

  function isNavItemActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function renderNavLink(item: WorkspaceNavItem) {
    const active = isNavItemActive(item.href);
    const Icon = getWorkspaceNavIcon(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
          active
            ? "bg-[var(--blue-muted)] text-[var(--blue-hover)]"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${active ? "text-[var(--blue)]" : "text-slate-400"}`}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  const nav = (
    <>
      <div className="border-b border-slate-200/80 bg-[var(--surface-sidebar)] px-4 py-4">
        <Link href="/" className="block" onClick={onClose}>
          <CapitalOSLogo height={32} />
        </Link>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2.5" aria-label={`${label} navigation`}>
        {adminSections
          ? adminSections.map((section, index) => (
              <div key={section.title ?? `section-${index}`} className={section.title ? "pt-1" : undefined}>
                {section.title ? (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {section.title}
                  </p>
                ) : null}
                <div className="space-y-0.5">{section.items.map(renderNavLink)}</div>
              </div>
            ))
          : items.map(renderNavLink)}
      </nav>
      <div className="space-y-2 border-t border-slate-200/80 bg-[var(--surface-sidebar)] p-3">
        {planBadge ? <div>{planBadge}</div> : null}
        <div className="rounded-xl border border-slate-200/80 bg-[var(--surface-sunken)] p-3">
          <div className="flex items-start gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--blue)] text-white">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-950">CapitalOS AI</p>
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
          className="fixed inset-0 z-40 bg-[var(--blue)]/20 lg:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
      <aside
        aria-label={`${label} sidebar`}
        className={`fixed inset-y-0 left-0 z-50 flex min-h-0 w-64 shrink-0 flex-col border-r border-slate-200/80 bg-[var(--surface-sidebar)] shadow-[var(--shadow-panel)] transition-transform lg:relative lg:z-30 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}
