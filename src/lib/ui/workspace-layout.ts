"use client";

/**
 * Which navigation layout a workspace renders.
 *  - "topmenu": Odoo-style top menu with an app launcher, no desktop sidebar.
 *  - "compact": admin's 44px bar with hub tabs and the icon rail (the layout before topmenu).
 *  - "classic": the original full sidebar.
 *
 * Topmenu is controlled per workspace by the runtime flag `<workspace>:nav_topmenu`
 * (served by /api/feature-controls as `topMenu`; absent = on for admin, off for founder
 * and investor). Admin: top menu or side menu is a company-wide choice made by a super
 * admin (admin Home settings); nobody picks it per person. Founder and investor can still
 * pick the classic layout from the avatar menu while their flag is on; stored per browser. Admin keeps its existing "admin.chrome" key, so pages
 * that read useAdminChrome() keep working: topmenu and compact both put the hub tabs in
 * the top bar, so for those pages both count as "compact".
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { WorkspaceId } from "@/lib/workspace-nav";
import type { AdminHomeLayout } from "@/lib/settings/admin-home-shape";
import { useAdminHomeSettings } from "@/lib/ui/admin-home-settings";

export type WorkspaceLayout = "topmenu" | "compact" | "classic";

const EVENT = "admin-chrome-change";
const FLAG_DEFAULTS: Record<WorkspaceId, boolean> = { admin: true, founder: false, investor: false };

function storageKey(workspace: WorkspaceId): string {
  return workspace === "admin" ? "admin.chrome" : `${workspace}.chrome`;
}
function flagCacheKey(workspace: WorkspaceId): string {
  return `nav.topmenu.${workspace}`;
}

function readStored(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** Pick classic (true) or the workspace default (false) for this browser. */
export function setWorkspaceClassic(workspace: WorkspaceId, classic: boolean) {
  try { window.localStorage.setItem(storageKey(workspace), classic ? "classic" : "topmenu"); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export function resolveLayout(workspace: WorkspaceId, flagOn: boolean, classic: boolean, adminLayout?: AdminHomeLayout): WorkspaceLayout {
  // Admin: the layout is a company-wide choice (super admin gear), not a per-person one.
  if (workspace === "admin") {
    // Top menu switched off by flag: the earlier layouts and their per-person switch, as before.
    if (!flagOn) return classic ? "classic" : "compact";
    return adminLayout === "side" ? "classic" : "topmenu";
  }
  if (classic) return "classic";
  return flagOn ? "topmenu" : "classic";
}

/** The layout for this workspace, plus whether the top menu is available to switch back to. */
export function useWorkspaceLayout(workspace: WorkspaceId): { layout: WorkspaceLayout; topMenuAvailable: boolean; adminCompanyLayout: boolean } {
  // Browser state (server render and first paint use the defaults).
  const stored = useSyncExternalStore(subscribe, () => readStored(storageKey(workspace)), () => null);
  // Last flag value this browser saw, so a founder whose flag is on doesn't flash the sidebar first.
  const cached = useSyncExternalStore(subscribe, () => readStored(flagCacheKey(workspace)), () => null);
  const [fetched, setFetched] = useState<{ workspace: WorkspaceId; on: boolean } | null>(null);
  const adminHome = useAdminHomeSettings(workspace === "admin");

  useEffect(() => {
    let alive = true;
    fetch("/api/feature-controls")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { topMenu?: Partial<Record<WorkspaceId, boolean>> } | null) => {
        const v = d?.topMenu?.[workspace];
        if (!alive || typeof v !== "boolean") return;
        setFetched({ workspace, on: v });
        try { window.localStorage.setItem(flagCacheKey(workspace), v ? "on" : "off"); } catch { /* ignore */ }
      })
      .catch(() => { /* keep the default */ });
    return () => { alive = false; };
  }, [workspace]);

  const flagOn =
    fetched?.workspace === workspace
      ? fetched.on
      : cached === "on" ? true : cached === "off" ? false : FLAG_DEFAULTS[workspace];

  const layout = resolveLayout(workspace, flagOn, stored === "classic", adminHome?.layout);

  // Keep admin.chrome in step with the company layout, so pages reading useAdminChrome()
  // (Sales and IR hide their own tab rows in the top bar layouts) never see a stale per-person value.
  useEffect(() => {
    if (workspace !== "admin" || layout === "compact") return;
    const want = layout === "classic" ? "classic" : "topmenu";
    if (readStored(storageKey("admin")) === want) return;
    try { window.localStorage.setItem(storageKey("admin"), want); } catch { return; }
    window.dispatchEvent(new Event(EVENT));
  }, [workspace, layout]);

  return {
    layout,
    // Admin has no per-person switch; founder and investor keep theirs while their flag is on.
    topMenuAvailable: workspace === "admin" ? false : flagOn,
    // Admin layout follows the super admin's company-wide choice (top menu flag on).
    adminCompanyLayout: workspace === "admin" && flagOn,
  };
}
