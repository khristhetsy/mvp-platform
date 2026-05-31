"use client";

import { ChevronDown } from "lucide-react";
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

  const companyLabel = profileSubtitle?.trim() || "Select company";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white shadow-[var(--shadow-sticky)]">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 lg:px-5">
        <button
          type="button"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
          aria-label="Open workspace menu"
          onClick={onMenuClick}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <WorkspaceBreadcrumbs workspace={workspace} />
        <span className="ml-auto hidden rounded-md bg-[var(--navy-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--navy)] sm:inline">
          {workspaceLabel(workspace)}
        </span>
      </div>
      <div className="flex flex-col gap-2 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between lg:px-5">
        <button
          type="button"
          className="flex max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-[var(--navy)]"
        >
          <span className="truncate">{companyLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
        </button>
        <div className="flex items-center justify-end gap-2">
          <NotificationBellDropdown />
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--navy)] text-[10px] font-semibold text-white">
              {initials || "CO"}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-[var(--navy)]">{profileName}</p>
              {profileSubtitle ? <p className="text-[11px] text-slate-500">{profileSubtitle}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
