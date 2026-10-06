"use client";

/**
 * The workspace nav as this person may see it, for the top menu layout. Same rules as
 * WorkspaceSidebar (kept in step with it, not shared, so the working sidebar is untouched):
 * admin RBAC permission + department access + Feature Controls hides at every level,
 * Reg-CF-only founder items, the iCFO Points item, the runtime founder nav V2 toggle,
 * and founder stage locks (shown, not hidden).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import type { InternalPermission } from "@/lib/rbac/constants";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/founder-journey/types";
import {
  getAdminWorkspaceNavSections,
  getFounderWorkspaceNavSections,
  getInvestorWorkspaceNavSections,
  isFounderNavV2Enabled,
  type WorkspaceId,
  type WorkspaceNavItem,
  type WorkspaceNavSection,
} from "@/lib/workspace-nav";
import { NAV_ES } from "@/components/WorkspaceSidebar";

const STAGE_LABELS: Record<string, string> = {
  initialize: "Stage 1 — Initialize",
  qualify: "Stage 2 — Qualify",
  deploy: "Stage 3 — Deploy",
  optimize: "Stage 4 — Optimize",
};

/** One GET, re-run when the url changes. `done` is false until it has answered (or failed). */
function useJson<T>(url: string | null): { data: T | null; done: boolean } {
  const [state, setState] = useState<{ url: string | null; data: T | null }>({ url: null, data: null });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setState({ url, data: (d as T) ?? null }); })
      .catch(() => { if (alive) setState({ url, data: null }); });
    return () => { alive = false; };
  }, [url]);
  return { data: state.url === url ? state.data : null, done: Boolean(url) && state.url === url };
}

export type GatedNav = {
  sections: WorkspaceNavSection[];
  isLocked: (item: WorkspaceNavItem) => boolean;
  lockHint: (minStage?: string) => string | undefined;
  tLabel: (label: string) => string;
};

export function useGatedNav(workspace: WorkspaceId): GatedNav {
  const locale = useLocale();
  const isAdmin = workspace === "admin";
  const isFounder = workspace === "founder";

  const permsL = useJson<{ permissions?: InternalPermission[]; isSuperAdmin?: boolean }>(isAdmin ? "/api/admin/users/permissions/me" : null);
  const deptL = useJson<{ unrestricted?: boolean; isAdmin?: boolean; paths?: string[] }>(isAdmin ? "/api/admin/departments/me" : null);
  const stageL = useJson<{ stage?: string }>(isFounder ? "/api/founder/journey/stage" : null);
  const offeringL = useJson<{ offeringType?: string | null }>(isFounder ? "/api/founder/offering-type" : null);
  const pointsL = useJson<{ enabled?: boolean }>("/api/credits/balance");
  const controlsL = useJson<{ disabledHrefs?: string[]; founderNavV2?: boolean }>("/api/feature-controls");

  const sections = useMemo(() => {
    // Same fallbacks as the sidebar: permissions unknown = gated items hidden; a failed
    // permissions call = no permissions; a failed department call = unrestricted.
    const perms = permsL.done ? { permissions: permsL.data?.permissions ?? [], isSuperAdmin: Boolean(permsL.data?.isSuperAdmin) } : null;
    const dept = deptL.done
      ? deptL.data ? { unrestricted: Boolean(deptL.data.unrestricted ?? deptL.data.isAdmin), paths: deptL.data.paths ?? [] } : { unrestricted: true, paths: [] as string[] }
      : null;
    const offeringType = offeringL.data?.offeringType ?? null;
    const founderNavV2 = typeof controlsL.data?.founderNavV2 === "boolean" ? controlsL.data.founderNavV2 : isFounderNavV2Enabled();

    const canShow = (item: WorkspaceNavItem): boolean => {
      if (isFounder) return !(item.requiresRegCf && offeringType !== "reg_cf");
      if (!isAdmin || !item.requiredPermission) return true;
      if (!perms) return false;
      if (perms.isSuperAdmin) return true;
      if (dept && !dept.unrestricted) return true;
      return perms.permissions.includes(item.requiredPermission);
    };
    const universal = ["/admin/contacts", "/admin/sales/contacts"];
    const deptAllows = (href: string): boolean => {
      if (!isAdmin) return true;
      if (universal.some((p) => href === p || href.startsWith(`${p}/`))) return true;
      if (!dept || dept.unrestricted) return true;
      return dept.paths.some((p) => (p === "/admin" ? href === "/admin" : href === p || href.startsWith(`${p}/`) || p.startsWith(`${href}/`)));
    };
    const hidden = new Set(controlsL.data?.disabledHrefs ?? []);
    if (!pointsL.data?.enabled) hidden.add("/credits");
    const gate = (list: WorkspaceNavItem[]): WorkspaceNavItem[] => list
      .filter(canShow)
      .map((item) => (item.children?.length ? { ...item, children: gate(item.children) } : item))
      .filter((item) => (item.children ? item.children.length > 0 : !hidden.has(item.href) && deptAllows(item.href)));

    const source = isAdmin
      ? getAdminWorkspaceNavSections()
      : isFounder
        ? getFounderWorkspaceNavSections(founderNavV2)
        : getInvestorWorkspaceNavSections();
    return source
      .map((section) => ({ ...section, items: gate(section.items) }))
      .filter((section) => section.items.length > 0);
  }, [isAdmin, isFounder, permsL.done, permsL.data, deptL.done, deptL.data, offeringL.data, controlsL.data, pointsL.data]);

  const stageName = stageL.data?.stage;
  const stageIndex = isFounder && stageName && JOURNEY_STAGES.includes(stageName as JourneyStage)
    ? JOURNEY_STAGES.indexOf(stageName as JourneyStage)
    : null;

  const isLocked = useCallback(
    (item: WorkspaceNavItem) => stageIndex != null && Boolean(item.minStage) && JOURNEY_STAGES.indexOf(item.minStage as JourneyStage) > stageIndex,
    [stageIndex],
  );
  const lockHint = useCallback((minStage?: string) => (minStage ? `Unlocks at ${STAGE_LABELS[minStage] ?? minStage}` : undefined), []);
  const tLabel = useCallback((label: string) => (locale === "es" ? NAV_ES[label] ?? label : label), [locale]);

  return { sections, isLocked, lockHint, tLabel };
}
