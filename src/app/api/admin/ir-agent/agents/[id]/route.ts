import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getAgentById, updateAgent } from "@/lib/ir-agent/store";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ action: z.enum(["archive", "restore"]) });

/** Archive takes the agent offline and out of the default list. Restore brings it back as a draft or paused agent, never live. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid agent." }, { status: 400 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const agent = await getAgentById(id);
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const result =
    parsed.data.action === "archive"
      ? await updateAgent(id, { archived_at: new Date().toISOString(), status: agent.status === "live" ? "paused" : agent.status })
      : await updateAgent(id, { archived_at: null });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Delete the agent with its questions, contact questions, Train data and conversations (all cascade). */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid agent." }, { status: 400 });
  const { error } = await serviceRoleClientUntyped().from("ir_agents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete the agent." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
