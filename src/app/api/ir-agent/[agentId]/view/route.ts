import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimitAsync } from "@/lib/ai-site/ratelimit";
import { clientIp } from "@/lib/ir-agent/ai";
import { getAgentById } from "@/lib/ir-agent/store";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const runtime = "edge";

type Params = { params: Promise<{ agentId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  sessionId: z.string().min(6).max(80),
  source: z.string().max(120).nullable().optional(),
});

/**
 * Records that a visitor opened a live agent page. One row per visitor session
 * (a repeat call for the same session is ignored). Public, so it is rate limited
 * like the conversation route, and it writes nothing about the visitor beyond the
 * random session id and the link tag that brought them.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { agentId } = await params;
  if (!UUID.test(agentId)) return NextResponse.json({ ok: false }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const limit = await checkRateLimitAsync({ ip: clientIp(req), sessionId: `view:${parsed.data.sessionId}` });
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });

  const agent = await getAgentById(agentId);
  if (!agent || agent.status !== "live") return NextResponse.json({ ok: false }, { status: 404 });

  const { error } = await serviceRoleClientUntyped()
    .from("ir_agent_views")
    .upsert({ agent_id: agent.id, session_id: parsed.data.sessionId, source: parsed.data.source ?? null }, { onConflict: "agent_id,session_id", ignoreDuplicates: true });
  if (error) {
    console.error("[ir-agent] view write failed", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
