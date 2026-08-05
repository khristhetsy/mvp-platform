import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { answerQuestion, getQuestionCompanyId } from "@/lib/data-room/qa";

export const dynamic = "force-dynamic";

// POST /api/founder/data-room/questions/[id]/answer — the founder answers a
// question on their own company's data room.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { answer?: string } | null;
  const answer = body?.answer?.trim();
  if (!answer) return NextResponse.json({ error: "An answer is required." }, { status: 400 });
  if (answer.length > 4000) {
    return NextResponse.json({ error: "Answer is too long (4000 characters max)." }, { status: 400 });
  }

  const companyId = await getQuestionCompanyId(id);
  if (!companyId) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  // Confirm this founder owns the company the question belongs to (RLS-backed read).
  const { data: owned } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("founder_id", profile.id)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: "Not your data room." }, { status: 403 });

  try {
    const saved = await answerQuestion({ questionId: id, companyId, answeredBy: profile.id, answer });
    if (!saved) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save." }, { status: 400 });
  }
}
