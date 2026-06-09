import { createServiceRoleClient } from "@/lib/supabase/admin";

export function calculateNextReview(intervalDays: number, easeFactor: number, score: number) {
  const newEase = Math.max(1.3, easeFactor + 0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
  const newInterval = score < 3 ? 1 : intervalDays === 1 ? 6 : Math.round(intervalDays * newEase);
  return { nextIntervalDays: newInterval, nextEaseFactor: newEase };
}

export async function scheduleReview(input: {
  founderId: string;
  companyId: string;
  moduleSlug: string;
  lessonId: string;
  questionId: string;
  score: number;
}) {
  const admin = createServiceRoleClient();
  const { data: prev } = await admin
    .from("founder_quiz_reviews")
    .select("*")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("module_slug", input.moduleSlug)
    .eq("lesson_id", input.lessonId)
    .eq("question_id", input.questionId)
    .maybeSingle();

  const { nextIntervalDays, nextEaseFactor } = calculateNextReview(
    prev?.interval_days ?? 1,
    Number(prev?.ease_factor ?? 2.5),
    input.score,
  );
  const nextReviewAt = new Date(Date.now() + nextIntervalDays * 86_400_000).toISOString();

  await admin.from("founder_quiz_reviews").upsert(
    {
      founder_id: input.founderId,
      company_id: input.companyId,
      module_slug: input.moduleSlug,
      lesson_id: input.lessonId,
      question_id: input.questionId,
      next_review_at: nextReviewAt,
      interval_days: nextIntervalDays,
      ease_factor: nextEaseFactor,
      last_score: input.score,
      review_count: (prev?.review_count ?? 0) + 1,
    },
    { onConflict: "founder_id,company_id,module_slug,lesson_id,question_id" },
  );

  return { nextReviewAt, nextIntervalDays };
}

export async function getDueReviews(founderId: string, companyId: string) {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("founder_quiz_reviews")
    .select("module_slug, lesson_id, question_id, next_review_at")
    .eq("founder_id", founderId)
    .eq("company_id", companyId)
    .lte("next_review_at", new Date().toISOString())
    .limit(10);

  return (data ?? []).map((row) => ({
    moduleSlug: String(row.module_slug),
    lessonId: String(row.lesson_id),
    questionId: String(row.question_id),
    nextReviewAt: String(row.next_review_at),
  }));
}
