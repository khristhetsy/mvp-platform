"use client";

import { useState, type ReactNode } from "react";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import type { WorkspaceId } from "@/lib/workspace-nav";

export function WorkspaceShell({
  workspace,
  profileName,
  profileSubtitle,
  planBadge,
  children,
}: Readonly<{
  workspace: WorkspaceId;
  profileName: string;
  profileSubtitle?: string;
  planBadge?: ReactNode;
  children: ReactNode;
}>) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full flex-1 overflow-hidden bg-[var(--surface-sunken)] text-slate-950">
      <WorkspaceSidebar
        workspace={workspace}
        planBadge={planBadge}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader
          workspace={workspace}
          profileName={profileName}
          profileSubtitle={profileSubtitle}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--background)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="cap-dashboard-page">{children}</div>
        </main>
      </div>
    </div>
  );
}
