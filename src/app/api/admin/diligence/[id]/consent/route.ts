import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { requestConsent } from "@/lib/diligence/consent";
import { ActionError } from "@/lib/diligence/admin-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ signer_name: z.string().min(1).max(160), signer_email: z.string().email() });

/** POST — freeze a version + open the founder consent e-sign envelope. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Signer name and email are required." }, { status: 400 });

  try {
    const result = await requestConsent(auth.supabase, id, auth.userId, { name: parsed.data.signer_name, email: parsed.data.signer_email });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
