import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminPublishedCourse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  readiness_focus: string;
  category: string | null;
  difficulty: string | null;
  content_status: string;
  is_published: boolean;
  order_index: number;
  created_at: string;
  video_url: string | null;
  banner_image_url: string | null;
};

export type AdminPublishedModule = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  estimated_time_minutes: number;
  difficulty: string;
  readiness_stage: string;
  order_index: number;
  content_status?: string;
  is_published: boolean;
};

export type AdminPublishedLesson = {
  id: string;
  module_id: string | null;
  module_slug: string;
  lesson_key: string;
  title: string;
  body_markdown: string;
  order_index: number;
  estimated_time_minutes: number;
  content_status: string;
  video_url?: string | null;
  slide_deck_url?: string | null;
  video_render_status?: string | null;
};

export type AdminPublishedQuiz = {
  id: string;
  scope_type: "course" | "module" | "lesson";
  program_id: string | null;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  passing_score: number;
  retry_limit: number | null;
  content_status: string;
};

export type AdminPublishedQuizQuestionPublic = {
  id: string;
  order_index: number;
  prompt: string;
  options: string[];
};

export async function listPublishedAdminCourses(): Promise<AdminPublishedCourse[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("learning_programs")
    .select(
      "id, slug, title, description, readiness_focus, category, difficulty, content_status, is_published, order_index, created_at, video_url, banner_image_url",
    )
    .eq("is_published", true)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []) as unknown as AdminPublishedCourse[];
}

export async function getPublishedAdminCourse(courseId: string): Promise<AdminPublishedCourse | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("learning_programs")
    .select(
      "id, slug, title, description, readiness_focus, category, difficulty, content_status, is_published, order_index, created_at, video_url, banner_image_url",
    )
    .eq("id", courseId)
    .eq("is_published", true)
    .maybeSingle();

  return (data as unknown as AdminPublishedCourse | null) ?? null;
}

export async function getPublishedAdminCourseBySlug(slug: string): Promise<AdminPublishedCourse | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("learning_programs")
    .select(
      "id, slug, title, description, readiness_focus, category, difficulty, content_status, is_published, order_index, created_at, video_url, banner_image_url",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  return (data as unknown as AdminPublishedCourse | null) ?? null;
}

export async function listPublishedAdminCourseModules(courseId: string): Promise<AdminPublishedModule[]> {
  const supabase = await createServerSupabaseClient();

  const { data: links } = await supabase
    .from("learning_program_modules")
    .select("module_id, order_index")
    .eq("program_id", courseId)
    .order("order_index", { ascending: true })
    .limit(200);

  const moduleIds = (links ?? []).map((l) => l.module_id);
  if (moduleIds.length === 0) return [];

  const { data: modules } = await supabase
    .from("learning_modules")
    .select(
      "id, slug, title, category, description, estimated_time_minutes, difficulty, readiness_stage, order_index, content_status, is_published",
    )
    .in("id", moduleIds)
    .eq("is_published", true)
    .limit(200);

  const byId = new Map((modules ?? []).map((m) => [m.id, m]));
  return (links ?? [])
    .map((l) => ({ ...byId.get(l.module_id), order_index: l.order_index } as unknown as AdminPublishedModule))
    .filter(Boolean);
}

export async function listPublishedAdminLessonsForModule(moduleSlug: string): Promise<AdminPublishedLesson[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("learning_lessons")
    .select("id, module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status, video_url, slide_deck_url, video_render_status")
    .eq("module_slug", moduleSlug)
    .eq("content_status", "published")
    .order("order_index", { ascending: true })
    .limit(500);

  return (data ?? []) as AdminPublishedLesson[];
}

export async function getPublishedAdminLesson(lessonId: string): Promise<AdminPublishedLesson | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("learning_lessons")
    .select("id, module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status, video_url, slide_deck_url, video_render_status")
    .eq("id", lessonId)
    .eq("content_status", "published")
    .maybeSingle();

  return (data as AdminPublishedLesson | null) ?? null;
}

export async function getPublishedCourseQuiz(courseId: string): Promise<AdminPublishedQuiz | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("learning_quizzes")
    .select("id, scope_type, program_id, module_id, lesson_id, title, passing_score, retry_limit, content_status")
    .eq("scope_type", "course")
    .eq("program_id", courseId)
    .eq("content_status", "published")
    .order("created_at", { ascending: false })
    .maybeSingle();

  return (data as AdminPublishedQuiz | null) ?? null;
}

export async function listPublishedQuizQuestionsPublic(quizId: string): Promise<AdminPublishedQuizQuestionPublic[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("learning_quiz_questions")
    .select("id, order_index, prompt, options")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true })
    .limit(200);

  return (data ?? []).map((row) => {
    const record = row as {
      id?: unknown;
      order_index?: unknown;
      prompt?: unknown;
      options?: unknown;
    };
    return {
      id: String(record.id ?? ""),
      order_index: typeof record.order_index === "number" ? record.order_index : Number(record.order_index ?? 0),
      prompt: String(record.prompt ?? ""),
      options: Array.isArray(record.options) ? (record.options as string[]) : [],
    };
  });
}

