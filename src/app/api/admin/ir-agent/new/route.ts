import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { ADMIN_DEFAULT_TYPE } from "@/lib/ir-agent/agent-types";
import { createStandaloneAgent } from "@/lib/ir-agent/store";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().trim().min(2).max(60) });

/** Start a new AI Agent with no company. A company can be linked later from the builder. */
export async function POST(req: Request) {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give the agent a name of 2 to 60 characters." }, { status: 400 });
  const agent = await createStandaloneAgent({ name: parsed.data.name, createdBy: auth.profile.id, agentType: ADMIN_DEFAULT_TYPE });
  if (!agent) return NextResponse.json({ error: "Could not create the agent." }, { status: 500 });
  return NextResponse.json({ agentId: agent.id, name: agent.company_name });
}
