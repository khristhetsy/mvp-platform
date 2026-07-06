import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getContactProfile } from "@/lib/sales/contacts";
import { listPipelines } from "@/lib/sales/pipelines";
import { SalesHubHeader } from "../../../SalesHubHeader";
import { ConvertClient } from "./ConvertClient";

export const dynamic = "force-dynamic";

export default async function ConvertContactPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const [data, pipelines] = await Promise.all([getContactProfile(id), listPipelines()]);
  if (!data) notFound();
  const pipes = pipelines.map((p) => ({ id: p.id, name: p.name, stages: p.stages.map((s) => ({ id: s.id, name: s.name })) }));
  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      <ConvertClient contact={data.contact} pipelines={pipes} />
    </AppShell>
  );
}
