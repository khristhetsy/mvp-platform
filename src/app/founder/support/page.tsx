import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listFounderRequests } from "@/lib/support/support";
import { FounderSupportClient, type FounderRequestRow } from "@/components/founder/FounderSupportClient";
import { RequestHelpButton } from "@/components/founder/RequestHelpButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support" };

export default async function FounderSupportPage() {
  const profile = await requireRole(["founder"]);
  const supabase = await createServerSupabaseClient();
  const requests = await listFounderRequests(supabase, profile.id);

  const rows: FounderRequestRow[] = requests.map((r) => ({
    id: r.id,
    subject: r.subject,
    status: r.status,
    contextItem: r.context_item,
    csat: r.csat,
    createdAt: r.created_at,
  }));

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle="Support">
      <PageHeader
        eyebrow="Help"
        title="Support"
        description="Your requests and conversations with the iCapOS team."
      />
      <RequestHelpButton contextItem="Support" />
      <FounderSupportClient rows={rows} />
    </FounderAppShell>
  );
}
