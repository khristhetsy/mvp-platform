import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { analyzeMeetingLog } from "@/lib/ceo/meeting-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ceo/meetings/analyze?filter=all|sales|mktg|operations|mgmt|staff
export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const filter = req.nextUrl.searchParams.get("filter") ?? "all";
    return NextResponse.json(await analyzeMeetingLog(filter));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Analysis failed." }, { status: 500 });
  }
}
