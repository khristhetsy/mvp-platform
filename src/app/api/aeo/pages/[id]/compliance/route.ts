import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getPage, setComplianceStatus, logAction } from "@/lib/aeo/store";
import { runAeoComplianceCheck } from "@/lib/aeo/compliance";

export const dynamic = "force-dynamic";

/** Run the language-library check on a page → set cleared/flagged + log it. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const { id } = await params;
    const page = await getPage(id);
    if (!page) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const result = runAeoComplianceCheck({
      lede: page.lede,
      definitionAnswer: page.definitionAnswer,
      sections: page.sections,
      faq: page.faq,
    });

    await setComplianceStatus(id, result.status);
    await logAction(
      id,
      result.status === "cleared" ? "compliance_cleared" : "compliance_flagged",
      profile.id,
      result.violations.length ? result.violations.map((v) => `${v.check}:${v.phrase}`).join(", ").slice(0, 400) : undefined,
    );

    return NextResponse.json({ status: result.status, violations: result.violations });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Check failed." }, { status: 500 });
  }
}
