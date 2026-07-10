import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listAssumptions, replaceAssumptions } from "@/lib/forecast/store";
import { ALL_DRIVER_KEYS } from "@/lib/forecast/engine";

export const dynamic = "force-dynamic";

const DRIVER_SET = new Set<string>(ALL_DRIVER_KEYS as readonly string[]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  return NextResponse.json({ assumptions: await listAssumptions(id) });
}

const rowSchema = z.object({
  driver_key: z.string().refine((k) => DRIVER_SET.has(k), "Unknown driver key."),
  segment: z.enum(["founder", "investor", "hot", "warm", "cold"]).nullable().optional(),
  month_from: z.number().int().min(0).max(120),
  month_to: z.number().int().min(0).max(120),
  value: z.number().finite(),
});
const putSchema = z.object({ assumptions: z.array(rowSchema).max(2000) });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (parsed.data.assumptions.some((r) => r.month_to < r.month_from)) {
    return NextResponse.json({ error: "Each row's month_to must be ≥ month_from." }, { status: 400 });
  }
  try {
    await replaceAssumptions(id, parsed.data.assumptions.map((r) => ({ ...r, segment: r.segment ?? null })), profile.id);
    return NextResponse.json({ assumptions: await listAssumptions(id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save assumptions." }, { status: 500 });
  }
}
