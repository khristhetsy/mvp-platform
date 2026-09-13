import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listPipelines, listBoardOpportunities, createPipeline } from "@/lib/sales/pipelines";
import { getSalesScope, effectiveSalesOwner } from "@/lib/sales/scope";
import { listAssignableStaff } from "@/lib/sales/settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const scope = await getSalesScope(profile, req.nextUrl.searchParams.get("viewAs"));
  const [pipelines, board, staff] = await Promise.all([listPipelines(), listBoardOpportunities(effectiveSalesOwner(scope)), listAssignableStaff()]);
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  for (const o of board) o.owner_name = o.owner_id ? nameById.get(o.owner_id) ?? null : null;
  return NextResponse.json({ pipelines, board, staff });
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
