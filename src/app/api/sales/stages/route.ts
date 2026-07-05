import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createStage } from "@/lib/sales/pipelines";

export const dynamic = "force-dynamic";

const schema = z.object({ pipelineId: z.string().uuid(), name: z.string().min(1).max(120) });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "pipelineId and name required." }, { status: 400 });
  try {
    await createStage(parsed.data.pipelineId, parsed.data.name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
