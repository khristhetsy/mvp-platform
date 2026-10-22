import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";
import { ADMIN_DEFAULT_TYPE, DEFAULT_AGENT_TYPE, type AgentType } from "./agent-types";
import { createAgentForOrg, getAgentById, getAgentByOrg, getFounderAgentAccess, type AccessResult } from "./store";
import type { AgentRow } from "./types";

export type FounderAgentContext = {
  profile: Profile;
  orgId: string;
  companyName: string;
  access: AccessResult;
  agent: AgentRow | null;
  /** True when an admin is building the agent for a founder company (the AI Agent page in Admin). */
  actingAdmin?: boolean;
};

/** Membership picks the starting question set: Founder membership loads the founder set, Investor membership the investor set. */
export function membershipAgentType(role: string | null | undefined): AgentType {
  return role === "investor" ? "investor" : DEFAULT_AGENT_TYPE;
}

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
  if (!agent && access.allowed && companyName) agent = await createAgentForOrg({ orgId, companyName, createdBy: profile.id, agentType: membershipAgentType(profile.role) });
  return { profile, orgId, companyName, access, agent };
}

const ADMIN_ACCESS: AccessResult = { allowed: true, reason: "ok", plan: null, override: null };

/**
 * An admin with manage_settings acting for any company in the account, SPVs
 * included. The agent is created on first use with the Admin default type,
 * hosted by the company's owner so bookings land on their calendar (the admin
 * when the company has no owner account). Plan access does not apply: admins
 * can build for any company.
 */
export async function loadAdminAgentContext(orgId: string): Promise<{ ctx: FounderAgentContext & { agent: AgentRow } } | { error: Response }> {
  if (!z.string().uuid().safeParse(orgId).success) return { error: NextResponse.json({ error: "Invalid company." }, { status: 400 }) };
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  const db = serviceRoleClientUntyped();
  const [{ data: org }, { data: company }] = await Promise.all([
    db.from("organizations").select("id, name, type").eq("id", orgId).maybeSingle(),
    db.from("companies").select("founder_id, company_name").eq("org_id", orgId).limit(1).maybeSingle(),
  ]);
  if (!org) return { error: NextResponse.json({ error: "Company not found." }, { status: 404 }) };

  const companyName = String((company as { company_name?: string } | null)?.company_name ?? (org as { name?: string }).name ?? "").trim();
  const ownerId = (company as { founder_id?: string } | null)?.founder_id ?? null;
  let agent = await getAgentByOrg(orgId);
  if (!agent) {
    if (!companyName) return { error: NextResponse.json({ error: "This company has no name yet, so an agent cannot be created." }, { status: 409 }) };
    agent = await createAgentForOrg({ orgId, companyName, createdBy: ownerId ?? auth.profile.id, agentType: ADMIN_DEFAULT_TYPE });
  }
  if (!agent) return { error: NextResponse.json({ error: "Could not create the agent." }, { status: 500 }) };
  return { ctx: { profile: auth.profile as Profile, orgId, companyName, access: ADMIN_ACCESS, agent, actingAdmin: true } };
}

/** An admin working on an agent by its id: how an agent without a company is reached. */
export async function loadAdminAgentContextById(agentId: string): Promise<{ ctx: FounderAgentContext & { agent: AgentRow } } | { error: Response }> {
  if (!z.string().uuid().safeParse(agentId).success) return { error: NextResponse.json({ error: "Invalid agent." }, { status: 400 }) };
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const agent = await getAgentById(agentId);
  if (!agent) return { error: NextResponse.json({ error: "Agent not found." }, { status: 404 }) };
  return { ctx: { profile: auth.profile as Profile, orgId: agent.organization_id ?? "", companyName: agent.company_name, access: ADMIN_ACCESS, agent, actingAdmin: true } };
}

/**
 * Founder routes call this with the request. ?orgId= or ?agentId= means an
 * admin acting for that company or agent; anything else is the signed in founder.
 */
export async function requireFounderAgentApi(req?: Request): Promise<{ ctx: FounderAgentContext & { agent: AgentRow } } | { error: Response }> {
  const params = req ? new URL(req.url).searchParams : null;
  const orgId = params?.get("orgId");
  if (orgId) return loadAdminAgentContext(orgId);
  const agentId = params?.get("agentId");
  if (agentId) return loadAdminAgentContextById(agentId);

  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const ctx = await loadFounderAgentContext(auth.profile);
  if (!ctx || !ctx.access.allowed) return { error: NextResponse.json({ error: "The IR agent is not enabled for this account." }, { status: 403 }) };
  if (!ctx.agent) return { error: NextResponse.json({ error: "Add your company name in Company profile first." }, { status: 409 }) };
  return { ctx: { ...ctx, agent: ctx.agent } };
}
