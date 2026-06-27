"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronLeft, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { InternalPermission } from "@/lib/rbac/constants";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/founder-journey/types";
import type { WorkspaceId, WorkspaceNavItem } from "@/lib/workspace-nav";
import { getAdminWorkspaceNavSections, getFounderWorkspaceNavSections, getInvestorWorkspaceNavSections, getWorkspaceNav, workspaceLabel } from "@/lib/workspace-nav";
import { getWorkspaceNavIcon } from "@/lib/ui/nav-icons";
import { useToast } from "@/components/ui/ToastProvider";
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

  // Live unread-email count for the Inbox nav badge (polled), plus a toast when
  // new mail arrives.
  const [unreadEmail, setUnreadEmail] = useState(0);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  const prevUnreadRef = useRef<number | null>(null);
  useEffect(() => {
    let active = true;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/email/unread-count");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const next: number = data.count ?? 0;
        const prev = prevUnreadRef.current;
        if (prev !== null && next > prev) {
          const delta = next - prev;
          toastRef.current({
            title: "New mail",
            description: `${delta} new message${delta === 1 ? "" : "s"} in your inbox.`,
            variant: "info",
          });
        }
        prevUnreadRef.current = next;
        setUnreadEmail(next);
      } catch {
        // ignore — badge just won't show
      }
    };
    void fetchCount();
    const id = setInterval(() => void fetchCount(), 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  function tLabel(label: string): string {
    const key = NAV_LABEL_KEYS[label];
    if (!key) return label;
    try { return t(key as Parameters<typeof t>[0]); } catch { return label; }
  }
  // Admin-controlled feature visibility — hrefs to hide for this user's role.
  const [disabledHrefs, setDisabledHrefs] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/feature-controls");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setDisabledHrefs(data.disabledHrefs ?? []);
      } catch {
        // ignore — show everything
      }
    })();
    return () => { active = false; };
  }, []);

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
    const hidden = new Set(disabledHrefs);
    return getWorkspaceNav(workspace)
      .filter(canShowNavItem)
      .map((item) => {
        if (item.children?.length) {
          return { ...item, children: item.children.filter((c) => !hidden.has(c.href)) };
        }
        return item;
      })
      .filter((item) => {
        // Drop leaf items whose href is hidden, and groups whose children are all hidden.
        if (item.children?.length === 0) return false;
        if (!item.children?.length && hidden.has(item.href)) return false;
        return true;
      });
  }, [canShowNavItem, workspace, disabledHrefs]);

  const sections = useMemo(() => {
    const source =
      workspace === "admin"
        ? getAdminWorkspaceNavSections()
        : workspace === "founder"
          ? getFounderWorkspaceNavSections()
          : getInvestorWorkspaceNavSections();
    if (!source) return null;
    const hidden = new Set(disabledHrefs);
    return source
      .map((section) => ({
        ...section,
        items: section.items
          .filter(canShowNavItem)
          .map((item) => (item.children?.length ? { ...item, children: item.children.filter((c) => !hidden.has(c.href)) } : item))
          .filter((item) => {
            // Drop groups whose children are all hidden, and hidden leaf items.
            if (item.children?.length === 0) return false;
            if (!item.children?.length && hidden.has(item.href)) return false;
            return true;
          }),
      }))
      .filter((section) => section.items.length > 0);
  }, [canShowNavItem, workspace, disabledHrefs]);

  const label = workspaceLabel(workspace);

  // Stage-aware lock state (founder only). Tools above the founder's current
  // stage are shown dimmed with a lock + "unlocks at Stage N" hint, rather than
  // hidden — so the roadmap stays visible without cluttering what's actionable now.
  const currentStageIndex = useMemo(() => {
    if (workspace !== "founder" || !founderStage) return null;
    const idx = JOURNEY_STAGES.indexOf(founderStage as JourneyStage);
    return idx >= 0 ? idx : null;
  }, [workspace, founderStage]);

  const isLocked = useMemo(
    () => (item: WorkspaceNavItem) => {
      if (currentStageIndex == null || !item.minStage) return false;
      return JOURNEY_STAGES.indexOf(item.minStage) > currentStageIndex;
    },
    [currentStageIndex],
  );

  function isNavItemActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function isChildActive(item: WorkspaceNavItem) {
    return item.children?.some((child) => isNavItemActive(child.href)) ?? false;
  }

  // ── Drill-in sub-menu (Vercel-style) ──────────────────────────────────────
  const allNavItems = useMemo<WorkspaceNavItem[]>(
    () => (sections ? sections.flatMap((s) => s.items) : items),
    [sections, items],
  );

  // The section the current route belongs to (deep-links / refresh open it).
  const routeDrilled = useMemo(() => {
    const parent = allNavItems.find(
      (it) => it.children?.length && it.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`)),
    );
    return parent?.href ?? null;
  }, [allNavItems, pathname]);

  // Manual drill/back overrides the route default — but only on the current page,
  // so navigating elsewhere falls back to that route's section automatically.
  const [userDrill, setUserDrill] = useState<{ at: string; value: string | null } | null>(null);
  const drilled = userDrill && userDrill.at === pathname ? userDrill.value : routeDrilled;
  const drilledItem = drilled
    ? allNavItems.find((it) => it.href === drilled && it.children?.length) ?? null
    : null;

  // Escape backs out of a drilled sub-menu.
  useEffect(() => {
    if (!drilled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserDrill({ at: pathname, value: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drilled, pathname]);

  function lockHint(item: WorkspaceNavItem): string | undefined {
    if (!item.minStage) return undefined;
    return `Unlocks at ${STAGE_LABELS[item.minStage] ?? item.minStage}`;
  }

  function renderLeafLink(item: WorkspaceNavItem, locked = false) {
    const active = isNavItemActive(item.href);
    const Icon = getWorkspaceNavIcon(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        title={locked ? lockHint(item) : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
          active
            ? "bg-[var(--blue-muted)] text-[var(--blue-hover)]"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
        } ${locked ? "opacity-55" : ""}`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${active ? "text-[var(--blue)]" : "text-slate-400"}`}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="truncate">{tLabel(item.label)}</span>
        {locked ? (
          <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
        ) : item.href.endsWith("/inbox") && unreadEmail > 0 ? (
          <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#534AB7] px-1.5 text-[11px] font-semibold text-white">
            {unreadEmail > 99 ? "99+" : unreadEmail}
          </span>
        ) : null}
      </Link>
    );
  }

  function renderTopLevel(item: WorkspaceNavItem, locked = false) {
    if (item.children && item.children.length > 0) {
      const parentActive = isChildActive(item);
      const Icon = getWorkspaceNavIcon(item.href);
      return (
        <button
          key={item.href}
          type="button"
          aria-haspopup="true"
          title={locked ? lockHint(item) : undefined}
          onClick={() => setUserDrill({ at: pathname, value: item.href })}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
            parentActive
              ? "bg-[var(--blue-muted)] text-[var(--blue-hover)]"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          } ${locked ? "opacity-55" : ""}`}
        >
          <Icon
            className={`h-4 w-4 shrink-0 ${parentActive ? "text-[var(--blue)]" : "text-slate-400"}`}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="truncate">{tLabel(item.label)}</span>
          {locked ? (
            <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
          ) : (
            <ChevronRight
              className={`ml-auto h-3.5 w-3.5 shrink-0 ${parentActive ? "text-[var(--blue)]" : "text-slate-400"}`}
              strokeWidth={2}
              aria-hidden
            />
          )}
        </button>
      );
    }
    return renderLeafLink(item, locked);
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
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Main list */}
        <nav
          aria-label={`${label} navigation`}
          aria-hidden={drilled ? true : undefined}
          className={`absolute inset-0 space-y-0.5 overflow-y-auto bg-[var(--surface-sidebar)] px-2 py-2.5 transition-transform duration-[260ms] ease-out ${
            drilled ? "pointer-events-none -translate-x-[24%]" : "translate-x-0"
          }`}
        >
          {sections
            ? sections.map((section, index) => (
                <div key={section.title ?? `section-${index}`} className={section.title ? "pt-1" : undefined}>
                  {section.title ? (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {tLabel(section.title)}
                    </p>
                  ) : null}
                  <div className="space-y-0.5">{section.items.map((it) => renderTopLevel(it, isLocked(it)))}</div>
                </div>
              ))
            : items.map((it) => renderTopLevel(it, isLocked(it)))}
        </nav>

        {/* Drilled sub-menu — slides in from the right */}
        <div
          aria-hidden={drilled ? undefined : true}
          className={`absolute inset-0 overflow-y-auto bg-[var(--surface-sidebar)] px-2 py-2.5 transition-transform duration-[260ms] ease-out ${
            drilled ? "translate-x-0" : "pointer-events-none translate-x-full"
          }`}
        >
          {drilledItem ? (
            <nav aria-label={`${tLabel(drilledItem.label)} navigation`} className="space-y-0.5">
              <button
                type="button"
                onClick={() => setUserDrill({ at: pathname, value: null })}
                className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-[13.5px] font-semibold text-[var(--navy)] transition-colors hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                <span className="truncate">{tLabel(drilledItem.label)}</span>
              </button>
              {drilledItem.children!.map((child) => renderLeafLink(child, isLocked(child)))}
            </nav>
          ) : null}
        </div>
      </div>
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
