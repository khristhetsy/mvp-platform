"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { InternalPermission } from "@/lib/rbac/constants";
import type { WorkspaceId, WorkspaceNavItem } from "@/lib/workspace-nav";
import { getAdminWorkspaceNavSections, getWorkspaceNav, workspaceLabel } from "@/lib/workspace-nav";
import { getWorkspaceNavIcon } from "@/lib/ui/nav-icons";
import { CapitalOSLogo } from "@/components/CapitalOSLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const NAV_LABEL_KEYS: Record<string, string> = {
  "Dashboard": "dashboard",
  "Actions": "actions",
  "Documents": "documents",
  "Messages": "messages",
  "Matching": "matching",
  "Analytics": "analytics",
  "Settings": "settings",
  "Learning": "learning",
  "Readiness": "readiness",
  "Checklist": "checklist",
  "Diligence & review": "diligenceReview",
  "Document checklist": "documentChecklist",
  "Missing documents": "missingDocuments",
  "Investors": "investors",
  "Overview": "overview",
  "Outreach & CRM": "outreachCrm",
  "Platform matches": "platformMatches",
  "Deal Room": "dealRoom",
  "Capital Raise": "capitalRaise",
  "SPVs": "spvs",
  "Companies": "companies",
  "CRM": "crm",
  "Activity": "activity",
  "Pipeline": "pipeline",
  "Outreach": "outreach",
  "Deal Rooms": "dealRooms",
  "Billing": "billing",
  "Operations": "operations",
  "Reports": "reports",
  "Insights": "insights",
  "Compliance": "compliance",
  "Diligence": "diligence",
  "Audit": "audit",
  "System": "system",
  "Integrations": "integrations",
  "Queues": "queues",
  "Automation": "automation",
  "System Health": "systemHealth",
  "Import / Export": "importExport",
  "Beta Operations": "betaOperations",
  "User Permissions": "userPermissions",
  "Deal Flow": "dealFlow",
  "Opportunities": "opportunities",
  "Watchlist": "watchlist",
  "Interest Pipeline": "interestPipeline",
  "Portfolio & Deals": "portfolioDeals",
  "Portfolio": "portfolio",
  "Onboarding": "onboarding",
};

const STAGE_LABELS: Record<string, string> = {
  initialize: "Stage 1 — Initialize",
  qualify: "Stage 2 — Qualify",
  deploy: "Stage 3 — Deploy",
  optimize: "Stage 4 — Optimize",
};

function useFounderStage(workspace: WorkspaceId) {
  const [stage, setStage] = useState<string | null>(null);

  useEffect(() => {
    if (workspace !== "founder") return;
    let cancelled = false;
    void fetch("/api/founder/journey/stage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stage?: string } | null) => {
        if (cancelled) return;
        if (data?.stage) setStage(data.stage);
      })
      .catch(() => { /* silent — indicator is non-critical */ });
    return () => { cancelled = true; };
  }, [workspace]);

  return stage;
}

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
  const t = useTranslations("nav");
  const adminNav = useAdminNavPermissions(workspace);
  const founderStage = useFounderStage(workspace);

  function tLabel(label: string): string {
    const key = NAV_LABEL_KEYS[label];
    if (!key) return label;
    try { return t(key as Parameters<typeof t>[0]); } catch { return label; }
  }
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

  function isChildActive(item: WorkspaceNavItem) {
    return item.children?.some((child) => isNavItemActive(child.href)) ?? false;
  }

  function NavItemWithChildren({ item }: Readonly<{ item: WorkspaceNavItem }>) {
    const parentActive = isChildActive(item);
    const [open, setOpen] = useState(parentActive);
    const Icon = getWorkspaceNavIcon(item.href);

    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
            parentActive
              ? "bg-[var(--blue-muted)] text-[var(--blue-hover)]"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          }`}
        >
          <Icon
            className={`h-4 w-4 shrink-0 ${parentActive ? "text-[var(--blue)]" : "text-slate-400"}`}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="truncate">{tLabel(item.label)}</span>
          <ChevronDown
            className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${parentActive ? "text-[var(--blue)]" : "text-slate-400"}`}
            strokeWidth={2}
            aria-hidden
          />
        </button>
        {open ? (
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
            {item.children!.map((child) => {
              const childActive = pathname === child.href;
              const ChildIcon = getWorkspaceNavIcon(child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onClose}
                  aria-current={childActive ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                    childActive
                      ? "bg-[var(--blue-muted)] text-[var(--blue-hover)]"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <ChildIcon
                    className={`h-3.5 w-3.5 shrink-0 ${childActive ? "text-[var(--blue)]" : "text-slate-400"}`}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="truncate">{tLabel(child.label)}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function renderNavLink(item: WorkspaceNavItem) {
    if (item.children && item.children.length > 0) {
      return <NavItemWithChildren key={item.href} item={item} />;
    }
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
        <span className="truncate">{tLabel(item.label)}</span>
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
        {founderStage ? (
          <span className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
            {STAGE_LABELS[founderStage] ?? founderStage}
          </span>
        ) : null}
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2.5" aria-label={`${label} navigation`}>
        {adminSections
          ? adminSections.map((section, index) => (
              <div key={section.title ?? `section-${index}`} className={section.title ? "pt-1" : undefined}>
                {section.title ? (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {tLabel(section.title)}
                  </p>
                ) : null}
                <div className="space-y-0.5">{section.items.map(renderNavLink)}</div>
              </div>
            ))
          : items.map(renderNavLink)}
      </nav>
      <div className="space-y-2 border-t border-slate-200/80 bg-[var(--surface-sidebar)] p-3">
        {planBadge ? <div>{planBadge}</div> : null}
        <LanguageSwitcher />
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
