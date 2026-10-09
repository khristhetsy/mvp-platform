import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { getWireInstructions, saveWireInstructions } from "@/lib/billing/wire";

export const dynamic = "force-dynamic";

/** GET: the wire instructions shown on every Premium invoice (manage_billing). */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_billing");
  if ("error" in auth) return auth.error as Response;
  return NextResponse.json({ instructions: await getWireInstructions() });
}

/** PUT: save them to platform_settings (key wire_instructions). */
export async function PUT(req: Request): Promise<Response> {
  const auth = await requirePermissionApi("manage_billing");
  if ("error" in auth) return auth.error as Response;
  try {
    const instructions = await saveWireInstructions(await req.json().catch(() => ({})), auth.userId);
    return NextResponse.json({ ok: true, instructions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
