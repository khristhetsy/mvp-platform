import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listProjects } from "@/lib/ir/db";
import { IrHubHeader } from "../IrHubTabs";
import { HubTasksClient } from "./HubTasksClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "IR Tasks" };

export default async function IrHubTasksPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const projects = (await listProjects({ status: "active" })).map((p) => ({ id: p.id, title: p.title, founder_name: p.founder_name }));
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <Suspense fallback={<p className="text-[13px] text-slate-400">Loading…</p>}><HubTasksClient meId={profile.id} projects={projects} /></Suspense>
    </AppShell>
  );
}
