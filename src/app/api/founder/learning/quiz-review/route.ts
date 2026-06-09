import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getDueReviews, scheduleReview } from "@/lib/learning/spaced-repetition";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ reviews: [], count: 0 });

  const reviews = await getDueReviews(auth.profile.id, company.id);
  return NextResponse.json({ reviews, count: reviews.length });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const moduleSlug = typeof body.moduleSlug === "string" ? body.moduleSlug : "";
  const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  const score = typeof body.score === "number" ? body.score : NaN;

  if (!moduleSlug || !lessonId || !questionId || Number.isNaN(score)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const result = await scheduleReview({
    founderId: auth.profile.id,
    companyId: company.id,
    moduleSlug,
    lessonId,
    questionId,
    score,
  });

  return NextResponse.json({ ok: true, nextReviewAt: result.nextReviewAt });
}
