// The agent brain: one conversational turn. Wraps Claude with the guardrail
// system prompt + tools, resolves the tool-use loop, and returns the spoken
// reply plus any tool calls. Vendor-neutral I/O so a Vapi/Retell adapter is a
// thin layer on top. Degrades gracefully with no ANTHROPIC_API_KEY.

import { CLAUDE_SONNET } from "@/lib/claude";
import { AI_DISCLOSURE } from "@/lib/voice/types";
import { buildGuardrailSystemPrompt, guardrailViolations, GUARDRAIL_VERSION } from "@/lib/voice/guardrail";
import { AGENT_TOOLS, runTool } from "@/lib/voice/tools";

export interface AgentTurnInput {
  contactId: string;
  audience: "founder" | "investor";
  contactName?: string | null;
  weakestDimension?: string | null;
  phone?: string | null;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface AgentTurnResult {
  reply: string;
  toolCalls: { name: string; input: unknown; result: unknown }[];
  guardrailVersion: string;
  violations: string[];
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };
type AnthropicMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const system = buildGuardrailSystemPrompt({
    contactId: input.contactId,
    audience: input.audience,
    contactName: input.contactName,
    weakestDimension: input.weakestDimension,
  });

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    const reply = `${AI_DISCLOSURE} I'd love to set up a short conversation with the iCFO team — is that alright?`;
    return { reply, toolCalls: [], guardrailVersion: GUARDRAIL_VERSION, violations: [] };
  }

  const convo: AnthropicMessage[] = input.messages.map((m) => ({ role: m.role, content: m.content }));
  const toolCalls: { name: string; input: unknown; result: unknown }[] = [];

  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CLAUDE_SONNET, max_tokens: 512, system, tools: AGENT_TOOLS, messages: convo }),
    });
    if (!res.ok) {
      const reply = `${AI_DISCLOSURE} I'm going to have a member of the iCFO team reach out to you directly.`;
      return { reply, toolCalls, guardrailVersion: GUARDRAIL_VERSION, violations: [] };
    }
    const data = (await res.json()) as { content: ContentBlock[]; stop_reason?: string };
    const blocks = data.content ?? [];
    const toolUses = blocks.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");

    if (toolUses.length === 0) {
      const text = blocks.filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text").map((b) => b.text).join("").trim();
      return { reply: text, toolCalls, guardrailVersion: GUARDRAIL_VERSION, violations: guardrailViolations(text) };
    }

    convo.push({ role: "assistant", content: blocks });
    const results: ContentBlock[] = [];
    for (const tu of toolUses) {
      const result = await runTool(tu.name, tu.input ?? {}, { contactId: input.contactId, audience: input.audience, phone: input.phone });
      toolCalls.push({ name: tu.name, input: tu.input, result });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
    }
    convo.push({ role: "user", content: results });
  }

  return { reply: "", toolCalls, guardrailVersion: GUARDRAIL_VERSION, violations: [] };
}
