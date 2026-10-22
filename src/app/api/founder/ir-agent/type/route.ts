import { NextResponse } from "next/server";
import { z } from "zod";
import { AGENT_TYPES, isAdminOnlyType } from "@/lib/ir-agent/agent-types";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { applyAgentType, buildPublicConfig, getQuestions } from "@/lib/ir-agent/store";

export const dynamic = "force-dynamic";

const schema = z.object({ agent_type: z.enum(AGENT_TYPES) });

/** Switch the AI Agent Type. Loads that type's question set, agent name and welcome. */
export async function PUT(req: Request) {
  const auth = await requireFounderAgentApi(req);
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid agent type." }, { status: 400 });
  if (isAdminOnlyType(parsed.data.agent_type) && !auth.ctx.actingAdmin) return NextResponse.json({ error: "Sales, Marketing and Investor Relations agents need Admin membership." }, { status: 403 });
  const result = await applyAgentType(auth.ctx.agent.id, parsed.data.agent_type);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ agent: result.agent, questions: await getQuestions(result.agent.id), config: await buildPublicConfig(result.agent) });
}
