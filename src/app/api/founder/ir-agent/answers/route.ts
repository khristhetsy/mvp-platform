import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { PERCENT } from "@/lib/ir-agent/ai";
import { violatesGuardrails } from "@/lib/ai-site/guardrails";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().trim().min(3).max(200),
  answer: z.string().trim().min(2).max(500),
});

/**
 * Teach the agent an answer. The same rules as the AI reply apply to what the
 * founder writes: no percentages, no guarantees, no funding promises, so a
 * taught answer can never put a promise in front of an investor.
 */
export async function POST(req: Request) {
  const auth = await requireFounderAgentApi(req);
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write the question and a short answer." }, { status: 400 });
  const { question, answer } = parsed.data;
  if (violatesGuardrails(answer) || PERCENT.test(answer)) {
    return NextResponse.json({ error: "Answers cannot include percentages, guarantees or funding promises. Keep figures for the call." }, { status: 400 });
  }
  const db = serviceRoleClientUntyped();
  const { count } = await db.from("ir_agent_answers").select("id", { count: "exact", head: true }).eq("agent_id", auth.ctx.agent.id);
  if ((count ?? 0) >= 60) return NextResponse.json({ error: "Up to 60 taught answers per agent." }, { status: 400 });
  const { data, error } = await db.from("ir_agent_answers").insert({ agent_id: auth.ctx.agent.id, question, answer }).select("id, question, answer").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not save." }, { status: 500 });
  return NextResponse.json({ answer: data });
}

export async function DELETE(req: Request) {
  const auth = await requireFounderAgentApi(req);
  if ("error" in auth) return auth.error;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await serviceRoleClientUntyped().from("ir_agent_answers").delete().eq("id", id).eq("agent_id", auth.ctx.agent.id);
  return NextResponse.json({ ok: true });
}
