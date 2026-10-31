/**
 * Whether an agent's chat runs in demo mode (no real bookings, no real email).
 *
 * Demo and internal accounts normally put their agents in demo mode. One
 * exception: a sales agent on an Internal account is iCFO's own agent talking to
 * its own prospects, so it must be able to book real meetings. A Demo account
 * stays in demo mode whatever the agent type, and an Internal account with
 * email dispatch switched off still counts as demo for every other agent type.
 */
export type OrgDemoFacts = { purpose: string | null; email_dispatch_enabled: boolean | null };

export function agentRunsInDemoMode(org: OrgDemoFacts | null, agentType?: string | null): boolean {
  if (!org) return false;
  if (agentType === "sales" && org.purpose === "internal") return false;
  return org.purpose === "demo" || org.purpose === "internal" || org.email_dispatch_enabled === false;
}
