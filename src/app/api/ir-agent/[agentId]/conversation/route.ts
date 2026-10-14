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
  transcript: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(600) })).max(80),
  profile: z.record(z.string(), z.unknown()),
  contact: z.record(z.string(), z.string().max(200)),
  booked: z.boolean(),
  stopped: z.boolean(),
});

/**
 * The conversation record for a founder's agent, written by the page as the
 * chat goes on. One row per visitor session, upserted. Public, so it is rate
 * limited like the reply route, and a visitor can only ever write their own session.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { agentId } = await params;
  if (!UUID.test(agentId)) return NextResponse.json({ ok: false }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const limit = await checkRateLimitAsync({ ip: clientIp(req), sessionId: `log:${parsed.data.sessionId}` });
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });

  const agent = await getAgentById(agentId);
  if (!agent || agent.status !== "live") return NextResponse.json({ ok: false }, { status: 404 });

  const d = parsed.data;
  const hasContact = Object.values(d.contact).some(Boolean);
  const { error } = await serviceRoleClientUntyped()
    .from("ir_agent_conversations")
    .upsert(
      {
        agent_id: agent.id,
        session_id: d.sessionId,
        source: d.source ?? null,
        transcript: d.transcript,
        profile: d.profile,
        contact: d.contact,
        stopped: d.stopped,
        booked_at: d.booked ? new Date().toISOString() : null,
        review_state: d.booked || hasContact ? "needs_review" : "new",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id,session_id" },
    );
  if (error) {
    console.error("[ir-agent] conversation write failed", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
