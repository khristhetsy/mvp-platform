import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { IrHubHeader } from "../../IrHubTabs";
import { NewProjectClient } from "./NewProjectClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "New IR project" };

export default async function NewIrProjectPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="Investor Relations Hub">
      <IrHubHeader />
      <NewProjectClient meId={profile.id} />
    </AppShell>
  );
}
