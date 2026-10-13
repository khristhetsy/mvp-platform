import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { normalizeEnding, validateEnding } from "@/lib/ir-agent/slug";
import { buildPublicConfig, endingTaken, getContactFields, getQuestions, getTaughtAnswers, updateAgent } from "@/lib/ir-agent/store";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServiceRoleClient, serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Everything the founder's My IR Agent page needs. */
export async function GET() {
  const auth = await requireFounderAgentApi();
  if ("error" in auth) return auth.error;
  const { agent, profile } = auth.ctx;
  const client = serviceRoleClientUntyped();
  const [questions, contactFields, answers, sources, config, google] = await Promise.all([
    getQuestions(agent.id),
    getContactFields(agent.id),
    getTaughtAnswers(agent.id),
    client.from("ir_agent_sources").select("id, file_name, bytes, status, created_at").eq("agent_id", agent.id).order("created_at", { ascending: false }),
    buildPublicConfig(agent),
    getGoogleConnectionStatus(createServiceRoleClient(), agent.host_profile_id ?? profile.id).catch(() => ({ connected: false, configured: false })),
  ]);
  return NextResponse.json({
    agent,
    questions,
    contactFields,
    answers,
    sources: sources.data ?? [],
    config,
    booking: { ready: config.bookingReady, googleConnected: Boolean(google.connected), hostId: agent.host_profile_id ?? profile.id },
    demo: config.demo,
  });
}

const patchSchema = z.object({
  ending: z.string().max(40).optional(),
  display_name: z.string().trim().min(1).max(60).optional(),
  company_name: z.string().trim().min(1).max(120).optional(),
  welcome_message: z.string().max(600).optional(),
  about: z.string().max(6000).optional(),
  status: z.enum(["draft", "live", "paused"]).optional(),
});

/** Save the Build tab. The company part of the address is locked; only the ending changes. */
export async function PUT(req: Request) {
  const auth = await requireFounderAgentApi();
  if ("error" in auth) return auth.error;
  const { agent } = auth.ctx;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const patch = { ...parsed.data };
  if (patch.ending !== undefined) {
    patch.ending = normalizeEnding(patch.ending);
    const check = validateEnding(patch.ending);
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });
    if (await endingTaken(agent.company_slug, patch.ending, agent.id)) return NextResponse.json({ error: "That ending is already in use." }, { status: 409 });
  }
  if (patch.welcome_message !== undefined) {
    patch.welcome_message = patch.welcome_message
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join("\n");
  }
  const result = await updateAgent(agent.id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ agent: result.agent, config: await buildPublicConfig(result.agent) });
}
