import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";
import { DEFAULT_AGENT_TYPE, type AgentType } from "./agent-types";
import { createAgentForOrg, getAgentByOrg, getFounderAgentAccess, type AccessResult } from "./store";
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

/**
 * An admin with manage_settings acting for any company in the account, SPVs
 * included. The agent is created on first use from the question set that
 * matches the owner's membership, hosted by the owner so bookings land on their
 * calendar (the admin when the company has no owner account). Plan access does
 * not apply: admins can build for any company.
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
    let role: string | null = null;
    if (ownerId) {
      const { data: owner } = await db.from("profiles").select("role").eq("id", ownerId).maybeSingle();
      role = (owner as { role?: string } | null)?.role ?? null;
    }
    agent = await createAgentForOrg({ orgId, companyName, createdBy: ownerId ?? auth.profile.id, agentType: membershipAgentType(role) });
  }
  if (!agent) return { error: NextResponse.json({ error: "Could not create the agent." }, { status: 500 }) };

  const access: AccessResult = { allowed: true, reason: "ok", plan: null, override: null };
  return { ctx: { profile: auth.profile as Profile, orgId, companyName, access, agent, actingAdmin: true } };
}

/**
 * Founder routes call this with the request. A request that carries ?orgId=
 * is an admin acting for that company; anything else is the signed in founder.
 */
export async function requireFounderAgentApi(req?: Request): Promise<{ ctx: FounderAgentContext & { agent: AgentRow } } | { error: Response }> {
  const orgId = req ? new URL(req.url).searchParams.get("orgId") : null;
  if (orgId) return loadAdminAgentContext(orgId);

  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const ctx = await loadFounderAgentContext(auth.profile);
  if (!ctx || !ctx.access.allowed) return { error: NextResponse.json({ error: "The IR agent is not enabled for this account." }, { status: 403 }) };
  if (!ctx.agent) return { error: NextResponse.json({ error: "Add your company name in Company profile first." }, { status: 409 }) };
  return { ctx: { ...ctx, agent: ctx.agent } };
}
