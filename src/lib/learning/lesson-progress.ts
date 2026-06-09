import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  countCompletedLessons,
  lessonProgressKey,
  moduleLessonCompletionPercent,
  progressByLessonKey,
} from "@/lib/learning/lesson-progress-utils";
import { track } from "@/lib/analytics/posthog";
import { checkAndAwardBadges, getLearningModuleBySlug, recordModuleView } from "@/lib/learning/progress";
import type { FounderLessonProgressRecord, LearningProgressStatus } from "@/lib/learning/types";

export {
  countCompletedLessons,
  lessonProgressKey,
  moduleLessonCompletionPercent,
  progressByLessonKey,
};

export async function listLessonProgressForCompany(founderId: string, companyId: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("founder_lesson_progress")
    .select("*")
    .eq("founder_id", founderId)
    .eq("company_id", companyId);

  if (error) {
    return [] as FounderLessonProgressRecord[];
  }

  return (data ?? []) as FounderLessonProgressRecord[];
}

export async function recordLessonView(input: {
  founderId: string;
  companyId: string;
  moduleSlug: string;
  lessonId: string;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("founder_lesson_progress")
    .select("*")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("module_slug", input.moduleSlug)
    .eq("lesson_id", input.lessonId)
    .maybeSingle();

  const payload = {
    founder_id: input.founderId,
    company_id: input.companyId,
    module_slug: input.moduleSlug,
    lesson_id: input.lessonId,
    status: (existing?.status === "completed" ? "completed" : "in_progress") as LearningProgressStatus,
    last_viewed_at: now,
  };

  if (existing) {
    await admin.from("founder_lesson_progress").update(payload).eq("id", existing.id);
  } else {
    await admin.from("founder_lesson_progress").insert(payload);
  }
}

export async function completeLesson(input: {
  founderId: string;
  companyId: string;
  moduleSlug: string;
  lessonId: string;
  quizScore?: number | null;
  quizPassed?: boolean | null;
}) {
  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("founder_lesson_progress")
    .select("*")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("module_slug", input.moduleSlug)
    .eq("lesson_id", input.lessonId)
    .maybeSingle();

  const row = {
    founder_id: input.founderId,
    company_id: input.companyId,
    module_slug: input.moduleSlug,
    lesson_id: input.lessonId,
    status: "completed" as const,
    quiz_score: input.quizScore ?? existing?.quiz_score ?? null,
    quiz_passed: input.quizPassed ?? existing?.quiz_passed ?? null,
    completed_at: now,
    last_viewed_at: now,
  };

  if (existing) {
    await admin.from("founder_lesson_progress").update(row).eq("id", existing.id);
  } else {
    await admin.from("founder_lesson_progress").insert(row);
  }

  await syncModuleProgressFromLessons(input);
  await checkAndAwardBadges(input.founderId, input.companyId);

  track("lesson_completed", {
    moduleSlug: input.moduleSlug,
    lessonId: input.lessonId,
    founderId: input.founderId,
  });
}

async function syncModuleProgressFromLessons(input: {
  founderId: string;
  companyId: string;
  moduleSlug: string;
}) {
  const { getCourseBySlug } = await import("@/lib/learning/courses");
  if (getCourseBySlug(input.moduleSlug)) return;

  const learningModule = await getLearningModuleBySlug(input.moduleSlug);
  if (!learningModule) return;

  const rows = await listLessonProgressForCompany(input.founderId, input.companyId);
  const completed = rows
    .filter((r) => r.module_slug === input.moduleSlug && r.status === "completed")
    .map((r) => r.lesson_id);

  await recordModuleView({
    founderId: input.founderId,
    companyId: input.companyId,
    moduleId: learningModule.id,
    moduleSlug: input.moduleSlug,
    completedLessonIds: completed,
  });
}

export async function recordQuizAttempt(input: {
  founderId: string;
  companyId: string;
  moduleSlug: string;
  lessonId: string;
  score: number;
  passed: boolean;
  answers: Record<string, string>;
}) {
  const admin = createServiceRoleClient();
  await admin.from("founder_quiz_attempts").insert({
    founder_id: input.founderId,
    company_id: input.companyId,
    module_slug: input.moduleSlug,
    lesson_id: input.lessonId,
    score: input.score,
    passed: input.passed,
    answers: input.answers,
  });

  const { data: existing } = await admin
    .from("founder_lesson_progress")
    .select("*")
    .eq("founder_id", input.founderId)
    .eq("company_id", input.companyId)
    .eq("module_slug", input.moduleSlug)
    .eq("lesson_id", input.lessonId)
    .maybeSingle();

  const now = new Date().toISOString();
  const row = {
    founder_id: input.founderId,
    company_id: input.companyId,
    module_slug: input.moduleSlug,
    lesson_id: input.lessonId,
    status: (input.passed ? "completed" : existing?.status ?? "in_progress") as LearningProgressStatus,
    quiz_score: input.score,
    quiz_passed: input.passed,
    completed_at: input.passed ? now : existing?.completed_at ?? null,
    last_viewed_at: now,
  };

  if (existing) {
    await admin.from("founder_lesson_progress").update(row).eq("id", existing.id);
  } else {
    await admin.from("founder_lesson_progress").insert(row);
  }

  if (input.passed) {
    await syncModuleProgressFromLessons(input);
    await checkAndAwardBadges(input.founderId, input.companyId);
  }
}

