import { NextResponse } from "next/server";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { agentUrl, normalizeEnding, validateEnding } from "@/lib/ir-agent/slug";
import { endingTaken } from "@/lib/ir-agent/store";

export const dynamic = "force-dynamic";

/** Availability check for the editable part of the address, as the founder types. */
export async function GET(req: Request) {
  const auth = await requireFounderAgentApi();
  if ("error" in auth) return auth.error;
  const { agent } = auth.ctx;
  const raw = new URL(req.url).searchParams.get("ending") ?? "";
  const ending = normalizeEnding(raw);
  const check = validateEnding(ending);
  if (!check.ok) return NextResponse.json({ ok: false, ending, reason: check.reason });
  if (await endingTaken(agent.company_slug, ending, agent.id)) return NextResponse.json({ ok: false, ending, reason: "That ending is already in use." });
  return NextResponse.json({ ok: true, ending, url: agentUrl(agent.company_slug, ending) });
}
