"use client";

import { NotificationBellDropdown } from "@/components/NotificationBellDropdown";
import { WorkspaceBreadcrumbs } from "@/components/ui/WorkspaceBreadcrumbs";
import type { WorkspaceId } from "@/lib/workspace-nav";
import { workspaceLabel } from "@/lib/workspace-nav";

type Props = {
  workspace: WorkspaceId;
  profileName: string;
  profileSubtitle?: string;
  onMenuClick?: () => void;
};

export function WorkspaceHeader({ workspace, profileName, profileSubtitle, onMenuClick }: Readonly<Props>) {
  const initials = profileName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-[var(--shadow-sticky)]">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 lg:px-6">
        <button
          type="button"
          className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
          aria-label="Open workspace menu"
          onClick={onMenuClick}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <WorkspaceBreadcrumbs workspace={workspace} />
        <span className="ml-auto hidden rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:inline">
          {workspaceLabel(workspace)}
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <label className="relative min-w-0 flex-1 lg:max-w-md">
          <span className="sr-only">Search workspace</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            type="search"
            disabled
            placeholder="Search (coming soon)"
            className="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-500"
          />
        </label>
        <div className="flex items-center justify-end gap-2">
          <NotificationBellDropdown />
          <div className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-[10px] font-semibold text-white">
              {initials || "CO"}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-slate-950">{profileName}</p>
              {profileSubtitle ? <p className="text-[11px] text-slate-500">{profileSubtitle}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
