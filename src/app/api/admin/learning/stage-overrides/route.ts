import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { CapitalStage } from "@/lib/learning/capital-stages";

export async function POST(request: Request) {
  try {
    await requireRole(["admin", "analyst"]);
    const { founderId, companyId, adminName, overrides } = (await request.json()) as {
      founderId: string;
      companyId: string;
      adminName: string;
      overrides: Partial<Record<CapitalStage, boolean | undefined>>;
    };

    if (!founderId || !companyId || !overrides) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;

    for (const [stage, value] of Object.entries(overrides)) {
      if (value === undefined) {
        // Remove override — revert to auto
        await db
          .from("admin_learning_stage_overrides")
          .delete()
          .eq("founder_id", founderId)
          .eq("company_id", companyId)
          .eq("capital_stage", stage);
      } else {
        // Upsert override
        await db.from("admin_learning_stage_overrides").upsert(
          {
            founder_id: founderId,
            company_id: companyId,
            capital_stage: stage,
            is_unlocked: value,
            overridden_by: adminName,
            overridden_at: new Date().toISOString(),
          },
          { onConflict: "founder_id,company_id,capital_stage" },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/learning/stage-overrides]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
