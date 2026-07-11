import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { generateRecommendations } from "@/lib/meetings/recap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST — cross-department advisory recommendation cards (no writes).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { sessionId } = await params;
  try {
    return NextResponse.json({ recommendations: await generateRecommendations(sessionId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate recommendations." }, { status: 500 });
  }
}
