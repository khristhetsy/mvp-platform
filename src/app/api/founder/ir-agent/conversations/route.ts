import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** The last 100 conversations with the agent, newest first. */
export async function GET() {
  const auth = await requireFounderAgentApi();
  if ("error" in auth) return auth.error;
  const { data } = await serviceRoleClientUntyped()
    .from("ir_agent_conversations")
    .select("id, session_id, source, transcript, profile, contact, review_state, booked_at, stopped, created_at, updated_at")
    .eq("agent_id", auth.ctx.agent.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ conversations: data ?? [] });
}

const patchSchema = z.object({ id: z.string().uuid(), review_state: z.enum(["new", "needs_review", "approved"]) });

export async function PATCH(req: Request) {
  const auth = await requireFounderAgentApi();
  if ("error" in auth) return auth.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await serviceRoleClientUntyped()
    .from("ir_agent_conversations")
    .update({ review_state: parsed.data.review_state })
    .eq("id", parsed.data.id)
    .eq("agent_id", auth.ctx.agent.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
