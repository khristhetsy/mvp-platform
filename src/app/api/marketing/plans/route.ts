import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import {
  getPlans,
  createPlan,
  createPlanItems,
  type CreatePlanInput,
} from "@/lib/marketing/plans";
import type { CmoPlanDraft } from "@/lib/marketing/types";

// GET /api/marketing/plans — list all plans (with item counts)
export async function GET(): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const plans = await getPlans();
    return NextResponse.json(plans);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/marketing/plans — create a plan.
// Optionally accepts `items` (e.g. when persisting an accepted AI CMO draft).
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const profile = await requireRole(["admin"]);
    const body = (await req.json()) as CreatePlanInput & {
      items?: CmoPlanDraft["items"];
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { items, ...planInput } = body;
    const plan = await createPlan(planInput, profile.id);

    if (Array.isArray(items) && items.length > 0) {
      await createPlanItems(
        plan.id,
        items.map((it, i) => ({
          title: it.title,
          description: it.description,
          channel: it.channel,
          priority: it.priority,
          sort_order: i,
        })),
      );
    }

    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
