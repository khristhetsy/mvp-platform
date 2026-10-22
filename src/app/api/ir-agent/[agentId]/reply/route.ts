import { NextResponse } from "next/server";
import { agentReply, founderSystemPrompt, replyRequestSchema } from "@/lib/ir-agent/ai";
import { FIELD_LABELS } from "@/lib/ir-agent/defaults";
import { getAgentById, getQuestions, getSourceTexts, getTaughtAnswers } from "@/lib/ir-agent/store";
import { wiredFactSheet } from "@/lib/ir-agent/wired";

export const runtime = "edge";

type Params = { params: Promise<{ agentId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The AI reply for a founder's IR agent. Public, so it carries every protection
 * Johnny's route has (rate limit, public AI budget, spend recording, guardrails),
 * all inside agentReply. The page runs the conversation; this writes the reply
 * from the founder's fact sheet, taught answers and trained PDFs.
 *
 * Draft agents answer too, so the founder's live preview works before going live.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { agentId } = await params;
  if (!UUID.test(agentId)) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = replyRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const agent = await getAgentById(agentId);
  if (!agent) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const [questions, taught, sources, wired] = await Promise.all([
    getQuestions(agent.id),
    getTaughtAnswers(agent.id),
    getSourceTexts(agent.id),
    // Company profile facts are wired only for the Admin built types. Founder agents answer from their own fact sheet, as before.
    (agent.agent_type ?? "founder") === "founder" ? Promise.resolve("") : wiredFactSheet(agent.organization_id, agent.wired_excluded ?? [], agent.company_name),
  ]);
  const system = founderSystemPrompt({
    displayName: agent.display_name,
    companyName: agent.company_name,
    about: [agent.about?.trim(), wired].filter(Boolean).join("\n\n") || null,
    taught,
    sources,
    fieldsAsked: questions
      .filter((q) => q.enabled && (q.field !== "custom" || (agent.agent_type ?? "founder") !== "founder"))
      .map((q) => (q.field === "custom" ? q.prompt.replace(/\?$/, "").toLowerCase().slice(0, 70) : FIELD_LABELS[q.field].toLowerCase())),
    agentType: agent.agent_type,
  });

  const result = await agentReply(req, parsed.data, system, "founder_ir_agent", `ir-agent:${agent.company_slug}`);
  if (!result.ok) {
    const headers = result.retryAfterSec ? { "Retry-After": String(result.retryAfterSec) } : undefined;
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers });
  }
  return NextResponse.json({ ok: true, ...result.reply });
}
