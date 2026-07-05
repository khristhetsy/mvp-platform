import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { OpsHubTabs } from "../OpsHubTabs";
import { OpsSettingsClient } from "./OpsSettingsClient";

export const dynamic = "force-dynamic";

export default async function OperationsSettingsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4338CA" }}>Admin Workspace</p>
        <h1 style={{ marginTop: 6, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>Operations hub</h1>
      </div>
      <OpsHubTabs />
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted-foreground)" }}>Tune the escalation SLAs, choose who owns escalations, and reach the operational tools.</p>
      <OpsSettingsClient />
    </AppShell>
  );
}
