import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const profile = await requireRole(["founder"]);
    const company = await ensureFounderCompanyForUser(profile);
    if (!company) return NextResponse.json({ error: "No company" }, { status: 400 });

    const { capitalStage, deliverableId, contentText } = (await request.json()) as {
      capitalStage: string;
      deliverableId: string;
      contentText: string;
    };

    if (!capitalStage || !deliverableId || !contentText?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Simple scoring heuristic until AI scoring is wired
    const wordCount = contentText.trim().split(/\s+/).length;
    const hasNumbers = /\d/.test(contentText);
    const hasSpecifics = contentText.length > 500;
    const aiScore = Math.min(
      100,
      Math.round(
        (wordCount > 200 ? 40 : wordCount > 100 ? 25 : 10) +
        (hasNumbers ? 25 : 0) +
        (hasSpecifics ? 20 : 0) +
        (contentText.length > 1000 ? 15 : 5),
      ),
    );

    const aiFeedback =
      aiScore >= 80
        ? "Strong submission — specific, detailed, and data-backed. Investors will find this compelling."
        : aiScore >= 60
          ? "Good start. Add more specific metrics and de-risk narrative to reach a higher score."
          : "Needs more detail. Include concrete numbers, milestones, and your specific situation.";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceRoleClient() as any;
    await db.from("learning_deliverable_submissions").upsert(
      {
        founder_id: profile.id,
        company_id: company.id,
        capital_stage: capitalStage,
        deliverable_id: deliverableId,
        content_text: contentText,
        ai_score: aiScore,
        ai_feedback: aiFeedback,
        submitted_at: new Date().toISOString(),
        scored_at: new Date().toISOString(),
      },
      { onConflict: "founder_id,company_id,capital_stage,deliverable_id" },
    );

    return NextResponse.json({ success: true, aiScore, aiFeedback });
  } catch (error) {
    console.error("[api/learning/deliverables]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
