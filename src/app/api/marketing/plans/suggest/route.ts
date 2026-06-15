import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { generatePlanDraft, type CmoBrief } from "@/lib/marketing/cmo";

// POST /api/marketing/plans/suggest — AI CMO generates an editable draft.
// Body: { goal: string, timeframe?: string, budget?: string }
// Does NOT persist; the client reviews/edits then POSTs to /api/marketing/plans.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const body = (await req.json()) as Partial<CmoBrief>;

    if (!body.goal?.trim()) {
      return NextResponse.json(
        { error: "goal is required" },
        { status: 400 },
      );
    }

    const draft = await generatePlanDraft({
      goal: body.goal,
      timeframe: body.timeframe,
      budget: body.budget,
    });
    return NextResponse.json(draft);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
