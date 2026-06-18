"use client";

import { useState, type ReactNode } from "react";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { CapitalOSAssistant } from "@/components/assistant/CapitalOSAssistant";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import type { WorkspaceId } from "@/lib/workspace-nav";

export function WorkspaceShell({
  workspace,
  profileName,
  profileSubtitle,
  profileEmail,
  planBadge,
  children,
}: Readonly<{
  workspace: WorkspaceId;
  profileName: string;
  profileSubtitle?: string;
  profileEmail?: string;
  planBadge?: ReactNode;
  children: ReactNode;
}>) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full flex-1 overflow-hidden bg-[var(--surface-base)] text-slate-950">
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
          profileEmail={profileEmail}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-x-hidden overflow-y-auto bg-[var(--background)] px-4 py-5 lg:px-6 lg:py-6">
          {children}
        </main>
        <CapitalOSAssistant />
        <GlobalSearchModal />
      </div>
    </div>
  );
}
