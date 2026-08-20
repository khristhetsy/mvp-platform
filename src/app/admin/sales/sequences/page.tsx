import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { SalesHubHeader } from "../SalesHubHeader";
import { getSequences } from "@/lib/marketing/sequences";
import { getTemplates } from "@/lib/marketing/templates";
import { getLists } from "@/lib/marketing/contacts";
import { getMarketingSettings } from "@/lib/marketing/settings";
import { SequencesClient } from "@/app/admin/marketing/sequences/SequencesClient";

export const dynamic = "force-dynamic";

// Sales Hub → Sequences. Reuses the exact Marketing sequence builder so sales
// users can create and run cadences without leaving the hub; the data is the
// same as Marketing → Sequences (one source of truth).
export default async function SalesSequencesPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [sequences, templates, lists, sender] = await Promise.all([
    getSequences(),
    getTemplates(),
    getLists(),
    getMarketingSettings().catch(() => null),
  ]);
  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle={profile.role}
      profileEmail={profile.email ?? undefined}
    >
      <SalesHubHeader />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h1 style={{ fontSize: 18, fontWeight: 500 }}>Sequences</h1>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginBottom: 16 }}>
          Build multi-step email cadences and enroll contacts. Map a sequence to a pipeline stage
          (Pipeline → Edit stages) to auto-enroll deals when they reach that stage.
        </p>
        <SequencesClient
          sequences={sequences}
          templates={templates}
          lists={lists}
          defaultSender={sender ? { name: sender.default_from_name, email: sender.default_from_email } : undefined}
        />
      </div>
    </AppShell>
  );
}
