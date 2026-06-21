import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { listEngagements, createEngagement } from "@/lib/diligence/data";

export const dynamic = "force-dynamic";

/** GET — pipeline list of engagements. */
export async function GET(): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const engagements = await listEngagements(auth.supabase);
  return NextResponse.json({ engagements });
}

const createSchema = z.object({
  company_name: z.string().min(1).max(160),
  round_label: z.string().max(80).nullish(),
  sector: z.string().max(80).nullish(),
  company_id: z.string().uuid().nullish(),
});

/** POST — create an engagement (seeds 5 domains + default gate). */
export async function POST(req: Request): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Company name is required." }, { status: 400 });

  try {
    const engagement = await createEngagement(auth.supabase, {
      companyName: parsed.data.company_name,
      roundLabel: parsed.data.round_label ?? null,
      sector: parsed.data.sector ?? null,
      ownerId: auth.userId,
      companyId: parsed.data.company_id ?? null,
    });
    return NextResponse.json({ engagement });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Create failed." }, { status: 500 });
  }
}
