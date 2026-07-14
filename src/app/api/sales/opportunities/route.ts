import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listOpportunities, createOpportunity, getDefaultPipeline } from "@/lib/sales/opportunities";
import { getSalesScope } from "@/lib/sales/scope";

export const dynamic = "force-dynamic";

// GET /api/sales/opportunities?archived= — list + stages for the default pipeline.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
  const scope = await getSalesScope(profile);
  const [opportunities, pipeline] = await Promise.all([listOpportunities(includeArchived, scope.isManager ? null : scope.ownerId), getDefaultPipeline()]);
  return NextResponse.json({ opportunities, stages: pipeline?.stages ?? [] });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  contactCrmId: z.string().max(120).optional().nullable(),
  valueCents: z.number().int().min(0).optional().nullable(),
  billing: z.enum(["yearly", "monthly"]).optional(),
  pipelineId: z.string().uuid().optional().nullable(),
  stageId: z.string().uuid().optional().nullable(),
  probability: z.number().int().min(0).max(100).optional().nullable(),
  expectedClose: z.string().max(20).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  leadStatus: z.string().max(80).optional().nullable(),
});

// POST /api/sales/opportunities — convert a contact into an opportunity.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A contact name is required." }, { status: 400 });
  const opportunity = await createOpportunity({ ...parsed.data, createdBy: profile.id });
  return NextResponse.json({ opportunity });
}
