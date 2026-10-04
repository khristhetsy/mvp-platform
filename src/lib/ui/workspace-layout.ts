"use client";

/**
 * Which navigation layout a workspace renders.
 *  - "topmenu": Odoo-style top menu with an app launcher, no desktop sidebar.
 *  - "compact": admin's 44px bar with hub tabs and the icon rail (the layout before topmenu).
 *  - "classic": the original full sidebar.
 *
 * Topmenu is controlled per workspace by the runtime flag `<workspace>:nav_topmenu`
 * (served by /api/feature-controls as `topMenu`; absent = on for admin, off for founder
 * and investor). A person can still pick the classic layout from the avatar menu; that
 * choice is stored per browser. Admin keeps its existing "admin.chrome" key, so pages
 * that read useAdminChrome() keep working: topmenu and compact both put the hub tabs in
 * the top bar, so for those pages both count as "compact".
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { WorkspaceId } from "@/lib/workspace-nav";

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

export function resolveLayout(workspace: WorkspaceId, flagOn: boolean, classic: boolean): WorkspaceLayout {
  if (classic) return "classic";
  if (flagOn) return "topmenu";
  return workspace === "admin" ? "compact" : "classic";
}

/** The layout for this workspace, plus whether the top menu is available to switch back to. */
export function useWorkspaceLayout(workspace: WorkspaceId): { layout: WorkspaceLayout; topMenuAvailable: boolean } {
  // Browser state (server render and first paint use the defaults).
  const stored = useSyncExternalStore(subscribe, () => readStored(storageKey(workspace)), () => null);
  // Last flag value this browser saw, so a founder whose flag is on doesn't flash the sidebar first.
  const cached = useSyncExternalStore(subscribe, () => readStored(flagCacheKey(workspace)), () => null);
  const [fetched, setFetched] = useState<{ workspace: WorkspaceId; on: boolean } | null>(null);

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

  return { layout: resolveLayout(workspace, flagOn, stored === "classic"), topMenuAvailable: flagOn };
}
