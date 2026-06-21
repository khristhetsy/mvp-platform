import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { sendToFounder, ActionError } from "@/lib/diligence/admin-actions";
import { setGate } from "@/lib/diligence/gate";
import { ddAudit } from "@/lib/diligence/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  founder_email: z.string().email(),
  gate: z.array(z.object({
    section: z.enum(["findings", "responses", "data_room", "candor", "icfo_review", "verdict"]),
    who: z.enum(["founder", "investor"]),
    visible: z.boolean(),
  })).max(12).optional(),
});

/** POST — send to founder: add member, apply default gate (+ overrides), transition, notify. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A valid founder email is required." }, { status: 400 });

  try {
    const result = await sendToFounder(auth.supabase, id, auth.userId, parsed.data.founder_email);
    // Apply any deliberate gate overrides from the send step.
    for (const g of parsed.data.gate ?? []) {
      await setGate(auth.supabase, id, g.section, g.who, g.visible);
    }
    if (parsed.data.gate?.length) {
      await ddAudit(auth.supabase, { engagementId: id, actorId: auth.userId, action: "gate.override", target: id, after: { count: parsed.data.gate.length } });
    }
    return NextResponse.json({ ok: true, delivered: result.delivered });
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed." }, { status: 500 });
  }
}
