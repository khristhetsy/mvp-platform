"use client";

import { createContext, useContext } from "react";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import type { WorkspaceId } from "@/lib/workspace-nav";

const WorkspaceChromeContext = createContext(false);

export function useWorkspaceChrome() {
  return useContext(WorkspaceChromeContext);
}

export function WorkspaceChrome({
  workspace,
  children,
}: Readonly<{
  workspace: WorkspaceId;
  children: React.ReactNode;
}>) {
  return (
    <WorkspaceChromeContext.Provider value={true}>
      <div className="flex min-h-screen w-full bg-workspace-shell text-zinc-950">
        <WorkspaceSidebar workspace={workspace} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </WorkspaceChromeContext.Provider>
  );
}
