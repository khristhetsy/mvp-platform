/**
 * Opens the agent's chat with the prospect's own thread.
 *
 * The email links to the chosen agent's public chat with ?src=<chat_tag>. That
 * tag points at one opportunity. If an email was sent from it, the chat opens
 * with what the prospect said (their own quoted words, checked against the thread
 * when the draft was made) and asks the same closing question the email ended on.
 *
 * Guards: the agent must be the one assigned to that opportunity, the email must
 * have been sent, and it must be recent. Anything else gives the agent's normal
 * chat. The chat component is not changed: it already opens from `welcome` and
 * asks `questions`, so both are overridden here.
 */
import type { AgentPublicConfig } from "@/lib/ir-agent/types";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { BRIDGE, cleanQuote } from "./draft";
import { OBJECTIONS, type Audit, type Objection } from "./types";

export type ProspectContext = {
  firstName: string | null;
  asked: string | null;
  concern: string | null;
  objection: Objection;
  closingQuestion: string;
};

/** A link older than this opens the normal chat. */
export const CONTEXT_MAX_AGE_DAYS = 60;

const OPP_TAG = /^opp-[0-9a-f]{10}$/;
export const isOpportunityTag = (tag: string | null | undefined): tag is string => Boolean(tag && OPP_TAG.test(tag));

export function personalizeConfig(config: AgentPublicConfig, ctx: ProspectContext): AgentPublicConfig {
  const name = ctx.firstName ? `, ${ctx.firstName}` : "";
  const lines = [`${config.displayName} here. Thanks for clicking${name}.`];
  if (ctx.asked) lines.push(`You asked: "${cleanQuote(ctx.asked)}"`);
  if (ctx.concern) lines.push(`${ctx.asked ? "You also wrote" : "You wrote"}: "${cleanQuote(ctx.concern)}"`);
  lines.push(BRIDGE[ctx.objection]);
  return {
    ...config,
    welcome: lines.slice(0, 4),
    // The email's closing question is the one question. The agent's own set follows from the answer.
    questions: [{ id: "sales-ai-closing", field: "custom", prompt: ctx.closingQuestion, options: [], enabled: true, position: 0 }],
  };
}

export async function loadProspectContext(tag: string | null, agentId: string, now = new Date()): Promise<ProspectContext | null> {
  if (!isOpportunityTag(tag)) return null;
  const db = serviceRoleClientUntyped();
  const { data: a } = await db.from("sales_ai_assignments").select("opportunity_id, agent_id").eq("chat_tag", tag).maybeSingle();
  const assignment = a as { opportunity_id: string; agent_id: string | null } | null;
  if (!assignment || assignment.agent_id !== agentId) return null;

  const since = new Date(now.getTime() - CONTEXT_MAX_AGE_DAYS * 86_400_000).toISOString();
  const [{ data: d }, { data: o }] = await Promise.all([
    db.from("sales_ai_drafts").select("audit, objection, sent_at").eq("opportunity_id", assignment.opportunity_id).eq("status", "sent").gte("sent_at", since).order("sent_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("sales_opportunities").select("contact_name").eq("id", assignment.opportunity_id).maybeSingle(),
  ]);
  const draft = d as { audit: Audit | null; objection: string | null } | null;
  if (!draft?.audit) return null;
  const objection = (OBJECTIONS as readonly string[]).includes(draft.objection ?? "") ? (draft.objection as Objection) : "unknown";
  const first = ((o as { contact_name: string | null } | null)?.contact_name ?? "").trim().split(/\s+/)[0] || null;
  return { firstName: first, asked: draft.audit.asked ?? null, concern: draft.audit.concern ?? null, objection, closingQuestion: draft.audit.closingQuestion };
}
