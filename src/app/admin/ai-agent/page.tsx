import { AppShell } from "@/components/AppShell";
import { AdminIrAgentBuilder, type AgentCompany } from "@/components/admin/AdminIrAgentBuilder";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermissionPage } from "@/lib/api/permissions";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * AI Agent (Admin): build an AI agent for any company, SPVs included.
 * Same studio as My IR Agent, with a company selector on top.
 */
export default async function AdminAiAgentPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { profile } = await requirePermissionPage("manage_settings");
  const { org } = await searchParams;
  const db = serviceRoleClientUntyped();
  const [orgs, agents] = await Promise.all([
    db.from("organizations").select("id, name, type").order("name").limit(1000),
    db.from("ir_agents").select("organization_id, status"),
  ]);
  const status = new Map<string, AgentCompany["status"]>(
    ((agents.data ?? []) as Array<{ organization_id: string; status: "draft" | "live" | "paused" }>).map((a) => [a.organization_id, a.status]),
  );
  const companies: AgentCompany[] = ((orgs.data ?? []) as Array<{ id: string; name: string | null; type: string | null }>)
    .filter((o) => (o.name ?? "").trim())
    .map((o) => ({ id: o.id, name: (o.name as string).trim(), kind: o.type === "spv" ? ("SPV" as const) : ("Company" as const), status: status.get(o.id) ?? null }));

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="AI Agent">
      <PageHeader
        eyebrow="Investor relations"
        title="AI Agent"
        description="Build an AI agent for any company in your account, SPVs included. The agent is wired to the company profile and field data of the company you pick."
      />
      <AdminIrAgentBuilder companies={companies} initialOrgId={org ?? null} />
    </AppShell>
  );
}
