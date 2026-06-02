"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { NotificationBellDropdown } from "@/components/NotificationBellDropdown";
import { CAPITALOS_LOGO_SRC } from "@/lib/ui/brand-logos";
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
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white shadow-[var(--shadow-sticky)]">
      <div className="flex min-h-[var(--workspace-header-height)] flex-wrap items-center gap-2 px-4 py-2.5 lg:gap-3 lg:px-5">
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
        <Link href="/" className="flex shrink-0 items-center self-center">
          <Image
            src={CAPITALOS_LOGO_SRC.wordmark}
            alt="CapitalOS"
            width={824}
            height={543}
            className="h-7 w-auto max-h-[calc(var(--workspace-header-height)-1rem)] max-w-[140px] shrink-0 object-contain object-left sm:max-w-[160px] lg:max-w-[200px]"
            sizes="(max-width: 640px) 140px, (max-width: 1024px) 160px, 200px"
            priority
          />
        </Link>
        <WorkspaceBreadcrumbs workspace={workspace} />
        <span className="hidden rounded-md bg-[var(--navy-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--navy)] sm:inline">
          {workspaceLabel(workspace)}
        </span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="hidden max-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-sm font-medium text-[var(--navy)] md:flex lg:max-w-xs"
          >
            <span className="truncate">{companyLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
          </button>
          <NotificationBellDropdown />
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--navy)] text-[10px] font-semibold text-white">
              {initials || "CO"}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-[var(--navy)]">{profileName}</p>
              {profileSubtitle ? <p className="text-[11px] text-slate-500">{profileSubtitle}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
