import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { investorHasCompanyDocumentAccess } from "@/lib/investor/document-access";
import { createQuestion } from "@/lib/data-room/qa";

export const dynamic = "force-dynamic";

type Body = { companyId?: string; documentId?: string | null; question?: string };

// POST /api/investor/data-room/questions — an investor asks a question about a
// company data room they have access to.
export async function POST(request: Request) {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error;
  const { supabase, profile } = auth;

  const body = (await request.json().catch(() => null)) as Body | null;
  const companyId = body?.companyId?.trim();
  const question = body?.question?.trim();
  if (!companyId || !question) {
    return NextResponse.json({ error: "A question and company are required." }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "Question is too long (2000 characters max)." }, { status: 400 });
  }

  const hasAccess = await investorHasCompanyDocumentAccess(supabase, profile.id, companyId);
  if (!hasAccess) {
    return NextResponse.json({ error: "You don't have access to this data room." }, { status: 403 });
  }

  try {
    await createQuestion({
      companyId,
      investorId: profile.id,
      documentId: body?.documentId ?? null,
      question,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not submit." }, { status: 400 });
  }
}
