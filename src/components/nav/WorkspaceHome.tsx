"use client";

/**
 * A workspace home page that is the app grid itself (admin: /admin/home). Same tiles,
 * colors and permission gating as the top menu launcher; a tile opens that hub.
 */
import { useRouter } from "next/navigation";
import type { WorkspaceId } from "@/lib/workspace-nav";
import { AppGrid, rememberApp, useTopMenuApps } from "@/components/nav/TopMenuBar";

export function WorkspaceHome({ workspace }: Readonly<{ workspace: WorkspaceId }>) {
  const router = useRouter();
  const { apps, tLabel } = useTopMenuApps(workspace);
  return (
    <div className="min-h-[calc(100vh-6rem)] rounded-xl bg-slate-50">
      <h1 className="sr-only">Home</h1>
      <AppGrid
        apps={apps}
        current={null}
        tLabel={tLabel}
        onPick={(app) => { rememberApp(workspace, app.id); router.push(app.href); }}
      />
    </div>
  );
}
