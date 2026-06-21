import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { upsertClaim, verifyClaim } from "@/lib/diligence/data";

export const dynamic = "force-dynamic";

const claimSchema = z.object({
  id: z.string().uuid().optional(),
  claim: z.string().min(1).max(500).optional(),
  claimed_value: z.string().max(300).nullish(),
  source_asserted: z.string().max(300).nullish(),
  verification: z.enum(["unverified", "requested", "submitted", "verified", "discrepancy"]).optional(),
  finding_id: z.string().uuid().nullish(),
  weight: z.number().int().min(1).max(10).optional(),
});

/** POST — create or update a claim. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = claimSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid claim." }, { status: 400 });

  try {
    const claim = await upsertClaim(auth.supabase, id, auth.userId, parsed.data);
    return NextResponse.json({ claim });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}

const verifySchema = z.object({
  claimId: z.string().uuid(),
  state: z.enum(["unverified", "requested", "submitted", "verified", "discrepancy"]),
});

/** PATCH — verify a claim; advances the linked finding + recomputes confidence. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = verifySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const { confidence } = await verifyClaim(auth.supabase, id, auth.userId, parsed.data.claimId, parsed.data.state);
    return NextResponse.json({ confidence });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verify failed." }, { status: 500 });
  }
}
