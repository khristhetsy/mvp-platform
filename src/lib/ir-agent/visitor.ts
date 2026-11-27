import type { AgentType } from "./agent-types";

/**
 * Who is typing to the agent. Founder and IR agents prospect investors, so the
 * visitor is an investor. Sales, marketing and investor (deal flow) agents talk
 * to a prospect or a company, so investor wording ("how you invest", "an
 * investor in SaaS") must not be used on them. No type means the original
 * investor agent.
 */
export function visitorIsInvestor(type?: AgentType | null): boolean {
  return !type || type === "founder" || type === "ir";
}
