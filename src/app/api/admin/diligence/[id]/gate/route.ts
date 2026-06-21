import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { setGate } from "@/lib/diligence/gate";
import { ddAudit } from "@/lib/diligence/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  section: z.enum(["findings", "responses", "data_room", "candor", "icfo_review", "verdict"]),
  who: z.enum(["founder", "investor"]),
  visible: z.boolean(),
});

/** POST — toggle a single visibility-gate cell. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid gate change." }, { status: 400 });

  await setGate(auth.supabase, id, parsed.data.section, parsed.data.who, parsed.data.visible);
  await ddAudit(auth.supabase, { engagementId: id, actorId: auth.userId, action: "gate.set", target: parsed.data.section, after: parsed.data });
  return NextResponse.json({ ok: true });
}
