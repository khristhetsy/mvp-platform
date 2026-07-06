import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../SalesHubHeader";
import { SalesSettingsClient } from "./SalesSettingsClient";

export const dynamic = "force-dynamic";

export default async function SalesSettingsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted-foreground)" }}>Task types (for the shared task engine) and reminder notifications.</p>
      <SalesSettingsClient />
    </AppShell>
  );
}
