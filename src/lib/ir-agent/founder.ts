import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import type { Profile } from "@/lib/supabase/types";
import { createAgentForOrg, getAgentByOrg, getFounderAgentAccess, type AccessResult } from "./store";
import type { AgentRow } from "./types";

export type FounderAgentContext = {
  profile: Profile;
  orgId: string;
  companyName: string;
  access: AccessResult;
  agent: AgentRow | null;
};

/**
 * The signed in founder's organization, access decision and agent. The agent is
 * created from the master template the first time an allowed founder opens the
 * page. Pages call this directly; API routes go through requireFounderAgentApi.
 */
export async function loadFounderAgentContext(profile: Profile): Promise<FounderAgentContext | null> {
  const { company, org } = await getActiveCompanyForUser(profile);
  const orgId = org?.id ?? (company as { org_id?: string | null } | null)?.org_id ?? null;
  const companyName = (company?.company_name ?? org?.name ?? "").trim();
  const access = await getFounderAgentAccess(profile.id, orgId);
  if (!orgId) return { profile, orgId: "", companyName, access, agent: null };
  let agent = await getAgentByOrg(orgId);
  if (!agent && access.allowed && companyName) agent = await createAgentForOrg({ orgId, companyName, createdBy: profile.id });
  return { profile, orgId, companyName, access, agent };
}

export async function requireFounderAgentApi(): Promise<{ ctx: FounderAgentContext & { agent: AgentRow } } | { error: Response }> {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const ctx = await loadFounderAgentContext(auth.profile);
  if (!ctx || !ctx.access.allowed) return { error: NextResponse.json({ error: "The IR agent is not enabled for this account." }, { status: 403 }) };
  if (!ctx.agent) return { error: NextResponse.json({ error: "Add your company name in Company profile first." }, { status: 409 }) };
  return { ctx: { ...ctx, agent: ctx.agent } };
}
