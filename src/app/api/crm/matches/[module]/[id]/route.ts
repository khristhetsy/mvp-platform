import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { loadFounderMatches, loadInvestorMatches } from "@/lib/crm/load-console";

export const dynamic = "force-dynamic";

/** GET /api/crm/matches/:module/:id — shared match layer, read from either direction. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ module: string; id: string }> },
): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { module, id } = await params;
  if (module !== "founder" && module !== "investor") {
    return NextResponse.json({ error: "Unknown module" }, { status: 400 });
  }
  try {
    const matches = module === "founder" ? await loadFounderMatches(id) : await loadInvestorMatches(id);
    return NextResponse.json({ matches });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to load matches." }, { status: 500 });
  }
}
