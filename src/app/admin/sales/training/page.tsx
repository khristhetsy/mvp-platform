import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listDocuments, listExamples, loadSettings } from "@/lib/sales-ai/training-store";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { SalesHubHeader } from "../SalesHubHeader";
import { TrainingClient, type TestOpportunity } from "./TrainingClient";

export const dynamic = "force-dynamic";

export default async function SalesAiTrainingPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const [settings, documents, examples, opps] = await Promise.all([
    loadSettings(),
    listDocuments(false),
    listExamples(),
    serviceRoleClientUntyped()
      .from("sales_opportunities")
      .select("id, title, contact_name, stage:sales_stages(name)")
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(25),
  ]);
  const options: TestOpportunity[] = ((opps.data ?? []) as unknown as Array<{ id: string; title: string; contact_name: string | null; stage: { name: string } | null }>).map((o) => ({
    id: o.id,
    label: `${o.title}${o.contact_name ? ` · ${o.contact_name}` : ""} · ${o.stage?.name ?? "No stage"}`,
  }));
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <TrainingClient initialSettings={settings} initialDocuments={documents} initialExamples={examples} opportunities={options} />
    </AppShell>
  );
}
