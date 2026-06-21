import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { addMember } from "@/lib/diligence/investor";
import { ddAudit } from "@/lib/diligence/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email(), role: z.enum(["founder", "investor"]) });

/** POST — add a founder/investor member by email (must have a matching account). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A valid email and role are required." }, { status: 400 });

  try {
    const { email } = await addMember(auth.supabase, id, parsed.data.email, parsed.data.role);
    await ddAudit(auth.supabase, { engagementId: id, actorId: auth.userId, action: "member.add", target: email, after: { role: parsed.data.role } });
    return NextResponse.json({ ok: true, email });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
