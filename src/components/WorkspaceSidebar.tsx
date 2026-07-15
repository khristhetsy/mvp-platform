"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronLeft, Lock } from "lucide-react";
import { useLocale } from "next-intl";
import type { InternalPermission } from "@/lib/rbac/constants";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/founder-journey/types";
import type { WorkspaceId, WorkspaceNavItem } from "@/lib/workspace-nav";
import { getAdminWorkspaceNavSections, getFounderWorkspaceNavSections, getInvestorWorkspaceNavSections, getWorkspaceNav, workspaceLabel } from "@/lib/workspace-nav";
import { getWorkspaceNavIcon } from "@/lib/ui/nav-icons";
import { useToast } from "@/components/ui/ToastProvider";
import { IcapOSLogo } from "@/components/IcapOSLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Complete English → Spanish dictionary for every sidebar nav label + section
// title. Applied directly when locale === "es" (see tLabel below).
const NAV_ES: Record<string, string> = {
  // Labels
  "AI diligence report": "Informe de diligencia con IA",
  "AI match center": "Centro de coincidencias IA",
  "Action Center": "Centro de acciones",
  "Actions": "Acciones",
  "Activation funnels": "Embudos de activación",
  "Activity": "Actividad",
  "All events": "Todos los eventos",
  "Analytics": "Análisis",
  "Applications": "Solicitudes",
  "Audit": "Auditoría",
  "Automation": "Automatización",
  "Beta Operations": "Operaciones beta",
  "Billing & subscription": "Facturación y suscripción",
  "Billing": "Facturación",
  "Board meeting prep": "Preparación de junta",
  "Browse courses": "Explorar cursos",
  "Business plan": "Plan de negocio",
  "CRM": "CRM",
  "Calendar": "Calendario",
  "Campaigns": "Campañas",
  "Cap table": "Tabla de capitalización",
  "Capital Raise": "Ronda de capital",
  "Checklist": "Lista de verificación",
  "Command Center": "Centro de control",
  "Communications": "Comunicaciones",
  "Companies": "Empresas",
  "Company profile": "Perfil de empresa",
  "Compliance": "Cumplimiento",
  "Contacts": "Contactos",
  "Courses": "Cursos",
  "Dashboard": "Panel",
  "Data room": "Sala de datos",
  "Deal Flow": "Flujo de operaciones",
  "Deal Room": "Sala de operaciones",
  "Deal Rooms": "Salas de operaciones",
  "Diligence & review": "Diligencia y revisión",
  "Diligence Tracker": "Seguimiento de diligencia",
  "Diligence": "Diligencia",
  "Document checklist": "Lista de documentos",
  "Documents": "Documentos",
  "Due diligence checklist": "Lista de debida diligencia",
  "E-Signatures": "Firmas electrónicas",
  "Email sequences": "Secuencias de correo",
  "Events": "Eventos",
  "Feature Controls": "Controles de funciones",
  "Feedback": "Comentarios",
  "Financial model": "Modelo financiero",
  "Founder roster": "Lista de fundadores",
  "Funding timeline": "Cronograma de financiación",
  "Fundraising": "Recaudación de fondos",
  "Gamification": "Gamificación",
  "IR CRM": "CRM de inversores",
  "Identity & accreditation": "Identidad y acreditación",
  "Import / Export": "Importar / Exportar",
  "Inbox": "Bandeja de entrada",
  "Insights": "Perspectivas",
  "Integrations": "Integraciones",
  "Interest Pipeline": "Flujo de interés",
  "Intro Requests": "Solicitudes de presentación",
  "Investor Updates": "Actualizaciones para inversores",
  "Investor update builder": "Generador de actualizaciones",
  "Investors": "Inversores",
  "KPI glossary": "Glosario de KPI",
  "Learning": "Aprendizaje",
  "Lists": "Listas",
  "Marketing Hub": "Centro de marketing",
  "Matches": "Coincidencias",
  "Matching": "Emparejamiento",
  "Meet": "Reunión",
  "Messages": "Mensajes",
  "Milestones": "Hitos",
  "Missing documents": "Documentos faltantes",
  "My Journey": "Mi trayecto",
  "My Profile": "Mi perfil",
  "My Schedule": "Mi agenda",
  "My learning plan": "Mi plan de aprendizaje",
  "My progress": "Mi progreso",
  "Notifications": "Notificaciones",
  "Operations Manual": "Manual de operaciones",
  "Operations": "Operaciones",
  "Opportunities": "Oportunidades",
  "Outreach & CRM": "Difusión y CRM",
  "Outreach (CRM)": "Difusión (CRM)",
  "Outreach": "Difusión",
  "Overview": "Resumen",
  "Page Builder": "Constructor de páginas",
  "Partner Score": "Puntuación de socio",
  "Partner Scores": "Puntuaciones de socio",
  "Pipeline": "Flujo",
  "Pitch deck analyzer": "Analizador de pitch deck",
  "Pitch practice": "Práctica de pitch",
  "Plans": "Planes",
  "Platform matches": "Coincidencias de la plataforma",
  "Portfolio & Deals": "Portafolio y operaciones",
  "Portfolio": "Portafolio",
  "Private Market": "Mercado privado",
  "Profile": "Perfil",
  "Queues": "Colas",
  "Raise Toolkit": "Kit de recaudación",
  "Readiness Scores": "Puntuaciones de preparación",
  "Readiness": "Preparación",
  "Recent Activity": "Actividad reciente",
  "Reg CF materials": "Materiales Reg CF",
  "Reports": "Informes",
  "SPVs & closings": "SPVs y cierres",
  "SPVs": "SPVs",
  "Scheduling": "Programación",
  "Score wizard": "Asistente de puntuación",
  "Sequences": "Secuencias",
  "Settings": "Configuración",
  "Sponsors": "Patrocinadores",
  "Stage 0 — Foundation": "Etapa 0 — Fundación",
  "Stage 1 — Seed Round": "Etapa 1 — Ronda semilla",
  "Stage 2 — Series A": "Etapa 2 — Serie A",
  "Stage 3 — Exit": "Etapa 3 — Salida",
  "Suppressions": "Supresiones",
  "System Health": "Estado del sistema",
  "System": "Sistema",
  "Tasks": "Tareas",
  "Team": "Equipo",
  "Templates": "Plantillas",
  "Term sheet explainer": "Explicación del term sheet",
  "User Management": "Gestión de usuarios",
  "User Permissions": "Permisos de usuario",
  "Watchlist": "Lista de seguimiento",
  // Section titles
  "Account": "Cuenta",
  "Admin": "Administración",
  "Grow": "Crecer",
  "Inbox & calendar": "Bandeja y calendario",
  "Investor Relations": "Relación con inversores",
  "Marketing": "Marketing",
  "My raise": "Mi ronda",
  "Operation": "Operación",
  "Stage 1 · Onboarding": "Etapa 1 · Incorporación",
  "Stage 2 · Verification": "Etapa 2 · Verificación",
  "Stage 3 · Deals access": "Etapa 3 · Acceso a operaciones",
  "Stage 4 · Manage deals": "Etapa 4 · Gestionar operaciones",
  "Workspace": "Espacio de trabajo",
  "Onboarding": "Incorporación",
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

// Department-scoped access for internal users. Additive on top of role permissions:
// non-admin departments only see nav whose href falls under a granted feature path.
// `unrestricted` (admin/legacy or pre-migration fail-open) shows everything.
function useDepartmentAccess(workspace: WorkspaceId) {
  const [access, setAccess] = useState<{ unrestricted: boolean; paths: string[] } | null>(null);
  useEffect(() => {
    if (workspace !== "admin") return;
    let cancelled = false;
    void fetch("/api/admin/departments/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { if (!cancelled) setAccess(d ? { unrestricted: Boolean(d.unrestricted ?? d.isAdmin), paths: d.paths ?? [] } : { unrestricted: true, paths: [] }); })
      .catch(() => { if (!cancelled) setAccess({ unrestricted: true, paths: [] }); });
    return () => { cancelled = true; };
  }, [workspace]);
  return access;
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
  const locale = useLocale();
  const adminNav = useAdminNavPermissions(workspace);
  const deptAccess = useDepartmentAccess(workspace);
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
    if (locale !== "es") return label;
    return NAV_ES[label] ?? label;
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

  // Department-path allow check (longest-prefix, additive to permissions).
  const deptAllows = useMemo(() => {
    // Paths every department can always reach, regardless of their scoped grants.
    // Contacts is the universal shared list (each member sees only their assigned rows).
    const universal = ["/admin/sales/contacts"];
    return (href: string) => {
      if (workspace !== "admin") return true;
      if (universal.some((p) => href === p || href.startsWith(`${p}/`))) return true;
      if (!deptAccess || deptAccess.unrestricted) return true;
      return deptAccess.paths.some((p) =>
        p === "/admin" ? href === "/admin" : href === p || href.startsWith(`${p}/`) || p.startsWith(`${href}/`),
      );
    };
  }, [deptAccess, workspace]);

  const items = useMemo(() => {
    const hidden = new Set(disabledHrefs);
    return getWorkspaceNav(workspace)
      .filter(canShowNavItem)
      .map((item) => {
        if (item.children?.length) {
          return { ...item, children: item.children.filter((c) => !hidden.has(c.href) && deptAllows(c.href)) };
        }
        return item;
      })
      .filter((item) => {
        // Drop leaf items whose href is hidden/out-of-department, and groups whose children are all gone.
        if (item.children?.length === 0) return false;
        if (!item.children?.length && (hidden.has(item.href) || !deptAllows(item.href))) return false;
        return true;
      });
  }, [canShowNavItem, deptAllows, workspace, disabledHrefs]);

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
          .map((item) => (item.children?.length ? { ...item, children: item.children.filter((c) => !hidden.has(c.href) && deptAllows(c.href)) } : item))
          .filter((item) => {
            // Drop groups whose children are all gone, and hidden/out-of-department leaf items.
            if (item.children?.length === 0) return false;
            if (!item.children?.length && (hidden.has(item.href) || !deptAllows(item.href))) return false;
            return true;
          }),
      }))
      .filter((section) => section.items.length > 0);
  }, [canShowNavItem, deptAllows, workspace, disabledHrefs]);

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
          <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2E78F5] px-1.5 text-[11px] font-semibold text-white">
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
          <IcapOSLogo height={32} />
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
