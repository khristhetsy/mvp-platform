"use client";

import { useState, type ReactNode } from "react";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { IcapOSAssistant } from "@/components/assistant/IcapOSAssistant";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { AdminHubTabsInline } from "@/components/admin/AdminHubTabsInline";
import { TopMenuBar, TopMenuInboxButton } from "@/components/nav/TopMenuBar";
import { setWorkspaceClassic, useWorkspaceLayout } from "@/lib/ui/workspace-layout";
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
  // Layout per workspace (see lib/ui/workspace-layout):
  //  - topmenu: Odoo-style top menu + app launcher, no desktop sidebar (spec: Top Menu Layout).
  //  - compact: admin's 44px bar with hub tabs and the icon rail.
  //  - classic: the full sidebar.
  const { layout, topMenuAvailable } = useWorkspaceLayout(workspace);
  const topMenu = layout === "topmenu";
  const compact = layout === "compact";

  // Avatar menu switch: classic ↔ the workspace's default. Admin without the top menu
  // keeps its existing compact ↔ classic switch (undefined = the header's own item).
  const layoutSwitch =
    layout === "classic"
      ? topMenuAvailable
        ? { label: "Switch to top menu layout", onSelect: () => setWorkspaceClassic(workspace, false) }
        : workspace === "admin" ? undefined : null
      : topMenu
        ? { label: "Switch to classic layout", onSelect: () => setWorkspaceClassic(workspace, true) }
        : undefined;

  return (
    <div
      className="flex h-screen w-full flex-1 overflow-hidden bg-[var(--surface-base)] text-slate-950"
      style={compact || topMenu ? ({ "--workspace-header-height": "2.75rem" } as React.CSSProperties) : undefined}
    >
      {topMenu ? (
        // Top menu: the sidebar is only the phone drawer (hidden on desktop).
        <div className="lg:hidden">
          <WorkspaceSidebar
            workspace={workspace}
            planBadge={planBadge}
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
          />
        </div>
      ) : (
        <WorkspaceSidebar
          workspace={workspace}
          planBadge={planBadge}
          mobileOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          compact={compact}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader
          workspace={workspace}
          profileName={profileName}
          profileSubtitle={profileSubtitle}
          profileEmail={profileEmail}
          accountSwitcher={accountSwitcher}
          onMenuClick={() => setMobileNavOpen(true)}
          compact={compact || topMenu}
          hubTabs={compact ? <AdminHubTabsInline /> : undefined}
          topMenu={topMenu ? <TopMenuBar workspace={workspace} /> : undefined}
          extraActions={topMenu ? <TopMenuInboxButton workspace={workspace} /> : undefined}
          layoutSwitch={layoutSwitch}
        />
        <main className={compact || topMenu
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
