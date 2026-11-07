/**
 * Server side of the weekly emailer AI writer: which agents can write, the
 * persona each one brings, and the model call. Facts always come from the live
 * market numbers on the server, never from the browser.
 */
import "server-only";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { claudeComplete, CLAUDE_SONNET, isClaudeConfigured } from "@/lib/claude";
import { AGENT_TYPE_SPECS, DEFAULT_AGENT_TYPE, type AgentType } from "@/lib/ir-agent/agent-types";
import { agentFactSheet } from "@/lib/ir-agent/ai";
import { getAgentById, getSourceTexts, getTaughtAnswers } from "@/lib/ir-agent/store";
import { wiredFactSheet } from "@/lib/ir-agent/wired";
import type { DigestMarket } from "./weekly-digest";
import type { Audience } from "./weekly-email";
import {
  DEFAULT_PERSONA, DEFAULT_WRITER_NAME, TARGET_LIMIT, WRITER_RULES, allowedFigures, checkOption, factOptions, numbersIn, parseOptions,
  rewriteTask, writeTask, type FactKey, type RewriteAction, type Target, type Tone,
} from "./weekly-ai";

export type WriterOption = {
  id: string;
  name: string;
  /** "Sales agent" */
  kind: string;
  status: "live" | "draft" | "paused";
  selectable: boolean;
  /** Founder and investor agents speak as their own company. */
  speaksAsCompany: boolean;
};

const kindLabel = (t: AgentType | null | undefined) => `${AGENT_TYPE_SPECS[t ?? DEFAULT_AGENT_TYPE].label} agent`;

/** Every agent that is not archived. Only live agents can write. */
export async function listWriters(): Promise<WriterOption[]> {
  const { data } = await serviceRoleClientUntyped()
    .from("ir_agents")
    .select("id, company_name, status, agent_type, archived_at")
    .is("archived_at", null)
    .order("company_name");
  return ((data ?? []) as Array<{ id: string; company_name: string; status: WriterOption["status"]; agent_type: AgentType | null }>).map((a) => ({
    id: a.id,
    name: a.company_name,
    kind: kindLabel(a.agent_type),
    status: a.status,
    selectable: a.status === "live",
    speaksAsCompany: (a.agent_type ?? DEFAULT_AGENT_TYPE) === "founder" || a.agent_type === "investor",
  }));
}

export type Persona = { name: string; system: string };

/** The default assistant, or a live agent with its own profile and knowledge. Null when the agent is missing or not live. */
export async function loadPersona(agentId: string | null): Promise<Persona | null> {
  if (!agentId || agentId === "default") return { name: DEFAULT_WRITER_NAME, system: `${DEFAULT_PERSONA}\n\n${WRITER_RULES}` };
  const agent = await getAgentById(agentId);
  if (!agent || agent.status !== "live" || agent.archived_at) return null;
  const type = agent.agent_type ?? DEFAULT_AGENT_TYPE;
  const [taught, sources, wired] = await Promise.all([
    getTaughtAnswers(agent.id),
    getSourceTexts(agent.id),
    type === "founder" ? Promise.resolve("") : wiredFactSheet(agent.organization_id, agent.wired_excluded ?? [], agent.company_name),
  ]);
  const sheet = agentFactSheet({ companyName: agent.company_name, about: [agent.about?.trim(), wired].filter(Boolean).join("\n\n") || null, taught, sources });
  const role = AGENT_TYPE_SPECS[type].role;
  return {
    name: agent.company_name,
    system:
      `You are ${agent.display_name}, the ${role} for ${agent.company_name}. You are drafting text for the Private Market weekly email, in the voice and style of ${agent.company_name}. ` +
      `The fact sheet below is background on ${agent.company_name}. Use it for voice and positioning only; every figure in your text must come from the email facts you are given, never from this sheet.\n\n` +
      `${sheet || `You have no fact sheet yet.`}\n\n${WRITER_RULES}`,
  };
}

export type WriteInput =
  | { action: "write"; audience: Audience; agentId: string | null; target: Target; tone: Tone; factKeys: FactKey[]; extra: string }
  | { action: "rewrite"; audience: Audience; agentId: string | null; rewrite: RewriteAction; text: string };

export type WriteResult = { ok: true; options: string[]; writer: string } | { ok: false; status: number; error: string };

export async function writeOptions(input: WriteInput, market: DigestMarket): Promise<WriteResult> {
  if (!isClaudeConfigured()) return { ok: false, status: 503, error: "AI writing is not configured (set ANTHROPIC_API_KEY)." };
  const persona = await loadPersona(input.agentId);
  if (!persona) return { ok: false, status: 400, error: "That agent is not live, so it cannot write. Pick a live agent or the default writer." };

  let task: string;
  let allowed: Set<string>;
  let limit: number;
  let keep: string[] = [];
  if (input.action === "write") {
    const all = factOptions(market, input.audience);
    const facts = all.filter((f) => input.factKeys.includes(f.key));
    if (facts.length === 0) return { ok: false, status: 400, error: "Tick at least one fact for the writer to use." };
    task = writeTask({ target: input.target, tone: input.tone, facts, extra: input.extra, audience: input.audience });
    allowed = allowedFigures(facts, input.extra);
    limit = TARGET_LIMIT[input.target];
  } else {
    if (!input.text.trim()) return { ok: false, status: 400, error: "Select some words in the note first." };
    task = rewriteTask({ action: input.rewrite, text: input.text });
    allowed = numbersIn(input.text);
    limit = TARGET_LIMIT.note;
    keep = input.text.match(/\{(rating|band|approved)\}/g) ?? [];
  }

  const out = await claudeComplete([{ role: "user", content: task }], {
    usage: { category: "internal", feature: "weekly_emailer_ai" },
    system: persona.system,
    model: CLAUDE_SONNET,
    maxTokens: input.action === "write" && input.target === "note" ? 900 : 500,
    temperature: 0.6,
    locale: "en",
  });
  const options = parseOptions(out)
    .map((o) => checkOption(o, allowed, limit, keep))
    .filter((c): c is { ok: true; text: string } => c.ok)
    .map((c) => c.text);
  if (options.length === 0) return { ok: false, status: 502, error: "The writer used a figure that is not in your facts, or went over the length. Try again." };
  return { ok: true, options: [...new Set(options)].slice(0, 3), writer: persona.name };
}
