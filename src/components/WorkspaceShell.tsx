"use client";

import { useState, type ReactNode } from "react";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { IcapOSAssistant } from "@/components/assistant/IcapOSAssistant";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { AdminHubTabsInline } from "@/components/admin/AdminHubTabsInline";
import { useAdminChrome } from "@/lib/ui/admin-chrome";
import type { WorkspaceId } from "@/lib/workspace-nav";

export function WorkspaceShell({
  workspace,
  profileName,
  profileSubtitle,
  profileEmail,
  planBadge,
  accountSwitcher,
  children,
}: Readonly<{
  workspace: WorkspaceId;
  profileName: string;
  profileSubtitle?: string;
  profileEmail?: string;
  planBadge?: ReactNode;
  accountSwitcher?: ReactNode;
  children: ReactNode;
}>) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Admin only: Odoo-style compact chrome (44px bar with hub tabs, icon rail). Founder
  // and investor workspaces keep the classic shell regardless.
  const chrome = useAdminChrome();
  const compact = workspace === "admin" && chrome === "compact";

  return (
    <div
      className="flex h-screen w-full flex-1 overflow-hidden bg-[var(--surface-base)] text-slate-950"
      style={compact ? ({ "--workspace-header-height": "2.75rem" } as React.CSSProperties) : undefined}
    >
      <WorkspaceSidebar
        workspace={workspace}
        planBadge={planBadge}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        compact={compact}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader
          workspace={workspace}
          profileName={profileName}
          profileSubtitle={profileSubtitle}
          profileEmail={profileEmail}
          accountSwitcher={accountSwitcher}
          onMenuClick={() => setMobileNavOpen(true)}
          compact={compact}
          hubTabs={compact ? <AdminHubTabsInline /> : undefined}
        />
        <main className={compact
          ? "w-full flex-1 overflow-x-hidden overflow-y-auto bg-[var(--background)] px-3 py-3 lg:px-4"
          : "mx-auto w-full max-w-[1600px] flex-1 overflow-x-hidden overflow-y-auto bg-[var(--background)] px-4 py-5 lg:px-6 lg:py-6"}>
          {children}
        </main>
        <IcapOSAssistant />
        <GlobalSearchModal workspace={workspace} />
      </div>
    </div>
  );
}
