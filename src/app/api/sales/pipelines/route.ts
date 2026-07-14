import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listPipelines, listBoardOpportunities, createPipeline } from "@/lib/sales/pipelines";
import { getSalesScope } from "@/lib/sales/scope";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const scope = await getSalesScope(profile);
  const [pipelines, board] = await Promise.all([listPipelines(), listBoardOpportunities(scope.isManager ? null : scope.ownerId)]);
  return NextResponse.json({ pipelines, board });
}

const schema = z.object({ name: z.string().min(1).max(120) });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A pipeline name is required." }, { status: 400 });
  const id = await createPipeline(parsed.data.name);
  return NextResponse.json({ id });
}
