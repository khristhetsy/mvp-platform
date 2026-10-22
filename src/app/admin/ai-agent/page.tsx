import { AppShell } from "@/components/AppShell";
import { AdminIrAgentBuilder, type AgentCompany, type StandaloneAgent } from "@/components/admin/AdminIrAgentBuilder";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermissionPage } from "@/lib/api/permissions";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Status = "draft" | "live" | "paused";

/**
 * AI Agent (Admin): build an AI agent for any company, SPVs included, or start
 * a new one with no company and link one later.
 */
export default async function AdminAiAgentPage({ searchParams }: { searchParams: Promise<{ org?: string; agent?: string }> }) {
  const { profile } = await requirePermissionPage("manage_settings");
  const { org, agent } = await searchParams;
  const db = serviceRoleClientUntyped();
  const [orgs, agents] = await Promise.all([
    db.from("organizations").select("id, name, type").order("name").limit(1000),
    db.from("ir_agents").select("id, organization_id, company_name, status, agent_type"),
  ]);
  const rows = (agents.data ?? []) as Array<{ id: string; organization_id: string | null; company_name: string; status: Status; agent_type: string | null }>;
  const status = new Map<string, Status>(rows.filter((a) => a.organization_id).map((a) => [a.organization_id as string, a.status]));
  const companies: AgentCompany[] = ((orgs.data ?? []) as Array<{ id: string; name: string | null; type: string | null }>)
    .filter((o) => (o.name ?? "").trim())
    .map((o) => ({ id: o.id, name: (o.name as string).trim(), kind: o.type === "spv" ? ("SPV" as const) : ("Company" as const), status: status.get(o.id) ?? null }));
  const standalone: StandaloneAgent[] = rows.filter((a) => !a.organization_id).map((a) => ({ id: a.id, name: a.company_name, status: a.status }));

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle="AI Agent">
      <PageHeader
        eyebrow="AI Agent"
        title="AI Agent"
        description="Build an AI agent for any company in your account, SPVs included. The agent is wired to the company profile and field data of the company you pick."
      />
      <AdminIrAgentBuilder companies={companies} standalone={standalone} initialOrgId={org ?? null} initialAgentId={agent ?? null} />
    </AppShell>
  );
}
