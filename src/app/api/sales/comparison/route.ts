import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getComparison, type Grain } from "@/lib/forecast/comparison";

export const dynamic = "force-dynamic";

const GRAINS = new Set<Grain>(["weekly", "monthly", "quarterly", "yearly"]);

// GET /api/sales/comparison?grain=weekly|monthly|quarterly|yearly
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const grain = (req.nextUrl.searchParams.get("grain") ?? "monthly") as Grain;
  if (!GRAINS.has(grain)) return NextResponse.json({ error: "Invalid grain." }, { status: 400 });
  return NextResponse.json(await getComparison(grain));
}
