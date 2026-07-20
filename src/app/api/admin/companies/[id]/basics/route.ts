import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaffApi } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/data/audit";

export const REVENUE_STAGES = ["pre_revenue", "early_revenue", "growing", "scaling"] as const;

const patchSchema = z.object({
  industry: z.string().trim().min(2, "Industry must be at least 2 characters.").max(80),
  revenue_stage: z.enum(REVENUE_STAGES).nullable().optional(),
  funding_amount: z.number().nonnegative().nullable().optional(),
});

/** Read the editable company basics. Staff only. */
export async function GET(_req: Request, { params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const db = auth.supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from("companies")
    .select("industry, revenue_stage, funding_amount")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: apiErrorMessage(error) }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  return NextResponse.json({
    industry: (data as { industry: string | null }).industry ?? "",
    revenue_stage: (data as { revenue_stage: string | null }).revenue_stage ?? null,
    funding_amount: (data as { funding_amount: number | null }).funding_amount ?? null,
  });
}

/** Update company basics (industry, revenue stage, funding target). Staff only; audited. */
export async function PATCH(request: Request, { params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error as NextResponse;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {
    industry: parsed.data.industry,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.revenue_stage !== undefined) patch.revenue_stage = parsed.data.revenue_stage;
  if (parsed.data.funding_amount !== undefined) patch.funding_amount = parsed.data.funding_amount;

  const db = auth.supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from("companies")
    .update(patch)
    .eq("id", id)
    .select("industry, revenue_stage, funding_amount")
    .single();
  if (error) return NextResponse.json({ error: apiErrorMessage(error) }, { status: 400 });

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "company.basics_updated",
    entityType: "company",
    entityId: id,
    metadata: {
      industry: parsed.data.industry,
      revenue_stage: parsed.data.revenue_stage ?? null,
      funding_amount: parsed.data.funding_amount ?? null,
    },
  });

  return NextResponse.json({ ok: true, ...data });
}
