"use client";

import { useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/lib/api/errors";
import { getModuleContent } from "@/lib/learning/modules";

type LearningContentStatus = "draft" | "pending_review" | "approved" | "published" | "archived";
type Difficulty = "introductory" | "intermediate" | "advanced";

type ModuleRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description?: string | null;
  readiness_stage: string;
  estimated_time_minutes?: number | null;
  difficulty?: string | null;
  content_status?: string | null;
  is_published?: boolean | null;
  order_index?: number | null;
};

type LessonRow = {
  id: string;
  module_slug: string;
  lesson_key: string;
  title: string;
  body_markdown?: string | null;
  order_index: number;
  estimated_time_minutes: number;
  content_status: string;
};

type QuizRow = {
  id: string;
  title: string;
  passing_score: number;
  retry_limit: number | null;
  content_status: string;
};

type QuestionRow = {
  id: string;
  order_index: number;
  prompt: string;
  options: string[];
  correct_option_index: number;
  explanation?: string | null;
};

type Props = {
  courseId: string;
  linkedModules: ModuleRow[];
};

const STATUS: LearningContentStatus[] = ["draft", "pending_review", "approved", "published", "archived"];
const DIFFICULTY: Difficulty[] = ["introductory", "intermediate", "advanced"];

type ApiJsonBody = Record<string, unknown>;

async function readApiJson(res: Response): Promise<ApiJsonBody> {
  const body = await res.json().catch(() => ({}));
  return body && typeof body === "object" ? (body as ApiJsonBody) : {};
}

export function AdminCourseContentStudio({ courseId, linkedModules }: Props) {
  const [modules, setModules] = useState<ModuleRow[]>(linkedModules);
  const [selectedModuleId, setSelectedModuleId] = useState<string>(linkedModules[0]?.id ?? "");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selectedModuleId) ?? null,
    [modules, selectedModuleId],
  );

  // Module create
  const [newModule, setNewModule] = useState<Partial<ModuleRow>>({
    slug: "",
    title: "",
    category: "Foundation",
    description: "",
    readiness_stage: "foundation",
    estimated_time_minutes: 15,
    difficulty: "intermediate",
    content_status: "draft",
    is_published: false,
    order_index: 0,
  });

  async function createModuleAndLink() {
    setLoading("create_module");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/learning/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newModule.slug,
          title: newModule.title,
          category: newModule.category,
          description: newModule.description,
          readiness_stage: newModule.readiness_stage,
          estimated_time_minutes: Number(newModule.estimated_time_minutes ?? 15),
          difficulty: (newModule.difficulty ?? "intermediate") as Difficulty,
          content_status: (newModule.content_status ?? "draft") as LearningContentStatus,
          is_published: Boolean(newModule.is_published),
          order_index: Number(newModule.order_index ?? 0),
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw json;
      const createdModule = json.module as ModuleRow;

      const linkRes = await fetch(`/api/admin/learning/courses/${encodeURIComponent(courseId)}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_id: createdModule.id, order_index: 0 }),
      });
      const linkJson = await readApiJson(linkRes);
      if (!linkRes.ok) throw linkJson;

      setModules((v) => [...v, createdModule]);
      setSelectedModuleId(createdModule.id);
      setSuccess("Module created and linked.");
      setNewModule((v) => ({ ...v, slug: "", title: "", description: "" }));
    } catch (e) {
      setError(formatApiError(e, "Unable to create module."));
    } finally {
      setLoading(null);
    }
  }

  async function saveModulePatch(patch: Partial<ModuleRow>) {
    if (!selectedModule) return;
    setLoading("save_module");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/learning/modules/${encodeURIComponent(selectedModule.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw json;
      const updated = json.module as ModuleRow;
      setModules((v) => v.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      setSuccess("Module saved.");
    } catch (e) {
      setError(formatApiError(e, "Unable to save module."));
    } finally {
      setLoading(null);
    }
  }

  // Lessons
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [lessonDraft, setLessonDraft] = useState<Partial<LessonRow>>({
    lesson_key: "",
    title: "",
    body_markdown: "",
    order_index: 0,
    estimated_time_minutes: 10,
    content_status: "draft",
  });

  useEffect(() => {
    void (async () => {
      if (!selectedModule) {
        setLessons([]);
        return;
      }
      try {
        const res = await fetch(`/api/admin/learning/lessons?moduleSlug=${encodeURIComponent(selectedModule.slug)}`);
        const json = await readApiJson(res);
        if (res.ok && Array.isArray(json.lessons)) setLessons(json.lessons as LessonRow[]);
      } catch {
        setLessons([]);
      }
    })();
  }, [selectedModule?.slug, selectedModule?.id]);

  async function createLesson() {
    if (!selectedModule) return;
    setLoading("create_lesson");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/learning/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: selectedModule.id,
          module_slug: selectedModule.slug,
          lesson_key: lessonDraft.lesson_key,
          title: lessonDraft.title,
          body_markdown: lessonDraft.body_markdown ?? "",
          order_index: Number(lessonDraft.order_index ?? 0),
          estimated_time_minutes: Number(lessonDraft.estimated_time_minutes ?? 10),
          content_status: (lessonDraft.content_status ?? "draft") as LearningContentStatus,
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw json;
      setLessons((v) => [...v, json.lesson as LessonRow].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
      setLessonDraft((v) => ({ ...v, lesson_key: "", title: "", body_markdown: "" }));
      setSuccess("Lesson created.");
    } catch (e) {
      setError(formatApiError(e, "Unable to create lesson."));
    } finally {
      setLoading(null);
    }
  }

  async function saveLesson(lessonId: string, patch: Partial<LessonRow>) {
    setLoading(`save_lesson:${lessonId}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/learning/lessons/${encodeURIComponent(lessonId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw json;
      const updated = json.lesson as LessonRow;
      setLessons((v) => v.map((l) => (l.id === updated.id ? updated : l)));
      setSuccess("Lesson saved.");
    } catch (e) {
      setError(formatApiError(e, "Unable to save lesson."));
    } finally {
      setLoading(null);
    }
  }

  // Quizzes (course scoped)
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/admin/learning/quizzes?programId=${encodeURIComponent(courseId)}`);
        const json = await readApiJson(res);
        if (res.ok && Array.isArray(json.quizzes)) {
          setQuizzes(json.quizzes as QuizRow[]);
          if (!selectedQuizId && (json.quizzes as QuizRow[])[0]?.id) setSelectedQuizId((json.quizzes as QuizRow[])[0].id);
        }
      } catch {
        setQuizzes([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    void (async () => {
      if (!selectedQuizId) {
        setQuestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/admin/learning/quizzes/${encodeURIComponent(selectedQuizId)}`);
        const json = await readApiJson(res);
        if (res.ok && Array.isArray(json.questions)) {
          setQuestions(
            (json.questions as QuestionRow[]).map((q) => ({
              id: q.id,
              order_index: q.order_index,
              prompt: q.prompt,
              options: Array.isArray(q.options) ? q.options : (q.options ?? []),
              correct_option_index: q.correct_option_index,
              explanation: q.explanation ?? null,
            })),
          );
        }
      } catch {
        setQuestions([]);
      }
    })();
  }, [selectedQuizId]);

  async function createQuiz() {
    setLoading("create_quiz");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/learning/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope_type: "course",
          program_id: courseId,
          title: "Course quiz",
          passing_score: 70,
          retry_limit: null,
          content_status: "draft",
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw json;
      const quiz = json.quiz as QuizRow;
      setQuizzes((v) => [quiz, ...v]);
      setSelectedQuizId(quiz.id);
      setSuccess("Quiz created.");
    } catch (e) {
      setError(formatApiError(e, "Unable to create quiz."));
    } finally {
      setLoading(null);
    }
  }

  async function saveQuizPatch(patch: Partial<QuizRow>) {
    if (!selectedQuizId) return;
    setLoading("save_quiz");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/learning/quizzes/${encodeURIComponent(selectedQuizId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw json;
      const updated = json.quiz as QuizRow;
      setQuizzes((v) => v.map((q) => (q.id === updated.id ? updated : q)));
      setSuccess("Quiz saved.");
    } catch (e) {
      setError(formatApiError(e, "Unable to save quiz."));
    } finally {
      setLoading(null);
    }
  }

  type StaticLessonDraft = {
    lessonId: string;
    title: string;
    summary: string;
    keyPointsText: string;
    worksheetPrompt: string;
    hasOverride: boolean;
  };

  const [staticLessons, setStaticLessons] = useState<StaticLessonDraft[]>([]);

  useEffect(() => {
    void (async () => {
      if (!selectedModule) {
        setStaticLessons([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/admin/learning/lesson-content?moduleSlug=${encodeURIComponent(selectedModule.slug)}`,
        );
        const json = await readApiJson(res);
        if (res.ok && Array.isArray(json.lessons)) {
          setStaticLessons(
            (json.lessons as Array<Record<string, unknown>>).map((lesson) => ({
              lessonId: String(lesson.lessonId),
              title: String(lesson.title ?? ""),
              summary: String(lesson.summary ?? ""),
              keyPointsText: Array.isArray(lesson.keyPoints)
                ? (lesson.keyPoints as string[]).join("\n")
                : "",
              worksheetPrompt: String(lesson.worksheetPrompt ?? ""),
              hasOverride: Boolean(lesson.hasOverride),
            })),
          );
          return;
        }
      } catch {
        // fall through to static defaults
      }

      const base = getModuleContent(selectedModule.slug);
      setStaticLessons(
        (base?.lessons ?? []).map((lesson) => ({
          lessonId: lesson.id,
          title: lesson.title,
          summary: lesson.summary,
          keyPointsText: lesson.keyPoints.join("\n"),
          worksheetPrompt: lesson.worksheetPrompt ?? "",
          hasOverride: false,
        })),
      );
    })();
  }, [selectedModule?.slug, selectedModule?.id]);

  async function saveStaticLesson(lesson: StaticLessonDraft) {
    if (!selectedModule) return;
    setLoading(`save_static:${lesson.lessonId}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/learning/lesson-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleSlug: selectedModule.slug,
          lessonId: lesson.lessonId,
          title: lesson.title,
          summary: lesson.summary,
          keyPoints: lesson.keyPointsText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          worksheetPrompt: lesson.worksheetPrompt || null,
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw json;
      setStaticLessons((rows) =>
        rows.map((row) => (row.lessonId === lesson.lessonId ? { ...lesson, hasOverride: true } : row)),
      );
      setSuccess("Founder lesson content override saved.");
    } catch (e) {
      setError(formatApiError(e, "Unable to save lesson content override."));
    } finally {
      setLoading(null);
    }
  }

  async function saveQuestions() {
    if (!selectedQuizId) return;
    setLoading("save_questions");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/learning/quizzes/${encodeURIComponent(selectedQuizId)}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: questions.map((q) => ({
            id: q.id,
            order_index: q.order_index,
            prompt: q.prompt,
            options: q.options,
            correct_option_index: q.correct_option_index,
            explanation: q.explanation ?? null,
          })),
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw json;
      setSuccess("Questions saved.");
    } catch (e) {
      setError(formatApiError(e, "Unable to save questions."));
    } finally {
      setLoading(null);
    }
  }

  function addQuestion() {
    setQuestions((v) => [
      ...v,
      {
        id: crypto.randomUUID(),
        order_index: (v[v.length - 1]?.order_index ?? 0) + 10,
        prompt: "Question prompt",
        options: ["Option A", "Option B"],
        correct_option_index: 0,
        explanation: "",
      },
    ]);
  }

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">Create module</p>
          <p className="text-xs text-slate-500">Creates a new `learning_modules` row, then links it to this course.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Title"
              value={newModule.title ?? ""}
              onChange={(e) => setNewModule((v) => ({ ...v, title: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              placeholder="Slug"
              value={newModule.slug ?? ""}
              onChange={(e) => setNewModule((v) => ({ ...v, slug: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Category"
              value={newModule.category ?? ""}
              onChange={(e) => setNewModule((v) => ({ ...v, category: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Readiness stage"
              value={newModule.readiness_stage ?? ""}
              onChange={(e) => setNewModule((v) => ({ ...v, readiness_stage: e.target.value }))}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={(newModule.content_status ?? "draft") as LearningContentStatus}
              onChange={(e) => setNewModule((v) => ({ ...v, content_status: e.target.value }))}
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={(newModule.difficulty ?? "intermediate") as Difficulty}
              onChange={(e) => setNewModule((v) => ({ ...v, difficulty: e.target.value }))}
            >
              {DIFFICULTY.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Description"
            value={newModule.description ?? ""}
            onChange={(e) => setNewModule((v) => ({ ...v, description: e.target.value }))}
          />
          <button
            type="button"
            disabled={loading !== null || !String(newModule.slug ?? "").trim() || !String(newModule.title ?? "").trim()}
            onClick={() => void createModuleAndLink()}
            className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading === "create_module" ? "Creating…" : "Create + link"}
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">Edit module</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              className="min-w-[240px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
            >
              <option value="">Select module…</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.slug})
                </option>
              ))}
            </select>
          </div>
          {selectedModule ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={selectedModule.title}
                onChange={(e) =>
                  setModules((v) => v.map((m) => (m.id === selectedModule.id ? { ...m, title: e.target.value } : m)))
                }
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                value={selectedModule.slug}
                onChange={(e) =>
                  setModules((v) => v.map((m) => (m.id === selectedModule.id ? { ...m, slug: e.target.value } : m)))
                }
              />
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={(selectedModule.content_status ?? "draft") as LearningContentStatus}
                onChange={(e) =>
                  setModules((v) =>
                    v.map((m) => (m.id === selectedModule.id ? { ...m, content_status: e.target.value } : m)),
                  )
                }
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={(selectedModule.difficulty ?? "intermediate") as Difficulty}
                onChange={(e) =>
                  setModules((v) =>
                    v.map((m) => (m.id === selectedModule.id ? { ...m, difficulty: e.target.value } : m)),
                  )
                }
              >
                {DIFFICULTY.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() =>
                  void saveModulePatch({
                    title: selectedModule.title,
                    slug: selectedModule.slug,
                    category: selectedModule.category,
                    description: selectedModule.description ?? "",
                    readiness_stage: selectedModule.readiness_stage,
                    estimated_time_minutes: Number(selectedModule.estimated_time_minutes ?? 15),
                    difficulty: (selectedModule.difficulty ?? "intermediate") as Difficulty,
                    content_status: (selectedModule.content_status ?? "draft") as LearningContentStatus,
                    is_published: Boolean(selectedModule.is_published),
                    order_index: Number(selectedModule.order_index ?? 0),
                  })
                }
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading === "save_module" ? "Saving…" : "Save module"}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Select a module to edit.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">Lessons</p>
          <p className="text-xs text-slate-500">Admin lesson drafts (do not replace founder lesson rendering in Phase 1).</p>
          {!selectedModule ? (
            <p className="mt-2 text-sm text-slate-600">Select a module to manage lessons.</p>
          ) : (
            <>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  placeholder="lesson_key"
                  value={lessonDraft.lesson_key ?? ""}
                  onChange={(e) => setLessonDraft((v) => ({ ...v, lesson_key: e.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Title"
                  value={lessonDraft.title ?? ""}
                  onChange={(e) => setLessonDraft((v) => ({ ...v, title: e.target.value }))}
                />
                <input
                  type="number"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="order"
                  value={Number(lessonDraft.order_index ?? 0)}
                  onChange={(e) => setLessonDraft((v) => ({ ...v, order_index: Number(e.target.value) }))}
                />
                <input
                  type="number"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="minutes"
                  value={Number(lessonDraft.estimated_time_minutes ?? 10)}
                  onChange={(e) => setLessonDraft((v) => ({ ...v, estimated_time_minutes: Number(e.target.value) }))}
                />
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={(lessonDraft.content_status ?? "draft") as LearningContentStatus}
                  onChange={(e) => setLessonDraft((v) => ({ ...v, content_status: e.target.value }))}
                >
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                rows={5}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                placeholder="Lesson body (markdown)"
                value={lessonDraft.body_markdown ?? ""}
                onChange={(e) => setLessonDraft((v) => ({ ...v, body_markdown: e.target.value }))}
              />
              <button
                type="button"
                disabled={loading !== null || !String(lessonDraft.lesson_key ?? "").trim() || !String(lessonDraft.title ?? "").trim()}
                onClick={() => void createLesson()}
                className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading === "create_lesson" ? "Creating…" : "Create lesson"}
              </button>

              <div className="mt-4 space-y-3">
                {lessons.length === 0 ? (
                  <p className="text-sm text-slate-600">No lessons for this module yet.</p>
                ) : (
                  lessons.map((l) => (
                    <div key={l.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={l.title}
                          onChange={(e) => setLessons((v) => v.map((x) => (x.id === l.id ? { ...x, title: e.target.value } : x)))}
                        />
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                          value={l.lesson_key}
                          onChange={(e) =>
                            setLessons((v) => v.map((x) => (x.id === l.id ? { ...x, lesson_key: e.target.value } : x)))
                          }
                        />
                        <input
                          type="number"
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={l.order_index}
                          onChange={(e) =>
                            setLessons((v) => v.map((x) => (x.id === l.id ? { ...x, order_index: Number(e.target.value) } : x)))
                          }
                        />
                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={(l.content_status ?? "draft") as LearningContentStatus}
                          onChange={(e) =>
                            setLessons((v) => v.map((x) => (x.id === l.id ? { ...x, content_status: e.target.value } : x)))
                          }
                        >
                          {STATUS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        rows={4}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                        value={l.body_markdown ?? ""}
                        onChange={(e) =>
                          setLessons((v) => v.map((x) => (x.id === l.id ? { ...x, body_markdown: e.target.value } : x)))
                        }
                      />
                      <button
                        type="button"
                        disabled={loading !== null}
                        onClick={() =>
                          void saveLesson(l.id, {
                            title: l.title,
                            lesson_key: l.lesson_key,
                            order_index: l.order_index,
                            estimated_time_minutes: l.estimated_time_minutes,
                            content_status: l.content_status as LearningContentStatus,
                            body_markdown: l.body_markdown ?? "",
                          })
                        }
                        className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {loading === `save_lesson:${l.id}` ? "Saving…" : "Save lesson"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">Quiz editor</p>
          <p className="text-xs text-slate-500">Multiple-choice quiz definitions (Phase 1 admin-managed).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void createQuiz()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading === "create_quiz" ? "Creating…" : "New quiz"}
            </button>
            <select
              className="min-w-[240px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
            >
              <option value="">Select quiz…</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>

          {selectedQuizId ? (
            <>
              {(() => {
                const q = quizzes.find((x) => x.id === selectedQuizId);
                if (!q) return null;
                return (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={q.title}
                      onChange={(e) => setQuizzes((v) => v.map((x) => (x.id === q.id ? { ...x, title: e.target.value } : x)))}
                    />
                    <select
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={(q.content_status ?? "draft") as LearningContentStatus}
                      onChange={(e) =>
                        setQuizzes((v) => v.map((x) => (x.id === q.id ? { ...x, content_status: e.target.value } : x)))
                      }
                    >
                      {STATUS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={q.passing_score}
                      onChange={(e) =>
                        setQuizzes((v) => v.map((x) => (x.id === q.id ? { ...x, passing_score: Number(e.target.value) } : x)))
                      }
                    />
                    <input
                      type="number"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={q.retry_limit ?? ""}
                      placeholder="retry limit (optional)"
                      onChange={(e) =>
                        setQuizzes((v) =>
                          v.map((x) =>
                            x.id === q.id ? { ...x, retry_limit: e.target.value.trim() ? Number(e.target.value) : null } : x,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      disabled={loading !== null}
                      onClick={() =>
                        void saveQuizPatch({
                          title: q.title,
                          passing_score: q.passing_score,
                          retry_limit: q.retry_limit,
                          content_status: q.content_status,
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {loading === "save_quiz" ? "Saving…" : "Save quiz"}
                    </button>
                  </div>
                );
              })()}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => addQuestion()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Add question
                </button>
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => void saveQuestions()}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading === "save_questions" ? "Saving…" : "Save questions"}
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {questions.map((qq, idx) => (
                  <div key={qq.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-600">Question {idx + 1}</p>
                      <input
                        type="number"
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        value={qq.order_index}
                        onChange={(e) =>
                          setQuestions((v) =>
                            v.map((x) => (x.id === qq.id ? { ...x, order_index: Number(e.target.value) } : x)),
                          )
                        }
                      />
                    </div>
                    <textarea
                      rows={2}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={qq.prompt}
                      onChange={(e) =>
                        setQuestions((v) => v.map((x) => (x.id === qq.id ? { ...x, prompt: e.target.value } : x)))
                      }
                    />
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {qq.options.map((opt, i) => (
                        <input
                          key={i}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={opt}
                          onChange={(e) =>
                            setQuestions((v) =>
                              v.map((x) =>
                                x.id === qq.id
                                  ? { ...x, options: x.options.map((o, oi) => (oi === i ? e.target.value : o)) }
                                  : x,
                              ),
                            )
                          }
                        />
                      ))}
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() =>
                          setQuestions((v) =>
                            v.map((x) => (x.id === qq.id ? { ...x, options: [...x.options, "New option"] } : x)),
                          )
                        }
                      >
                        Add option
                      </button>
                      <select
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={qq.correct_option_index}
                        onChange={(e) =>
                          setQuestions((v) =>
                            v.map((x) => (x.id === qq.id ? { ...x, correct_option_index: Number(e.target.value) } : x)),
                          )
                        }
                      >
                        {qq.options.map((_, i) => (
                          <option key={i} value={i}>
                            Correct: option {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Optional explanation"
                      value={qq.explanation ?? ""}
                      onChange={(e) =>
                        setQuestions((v) => v.map((x) => (x.id === qq.id ? { ...x, explanation: e.target.value } : x)))
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Create or select a quiz to edit questions.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-900">Founder curriculum overrides</p>
        <p className="text-xs text-slate-500">
          Edit static lesson content from <code className="font-mono">modules.ts</code> defaults. Database overrides
          take precedence for founders.
        </p>
        {!selectedModule ? (
          <p className="mt-2 text-sm text-slate-600">Select a module to edit founder-facing lesson content.</p>
        ) : staticLessons.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No static lessons for this module slug.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {staticLessons.map((lesson) => (
              <div key={lesson.lessonId} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs text-slate-500">{lesson.lessonId}</p>
                  {lesson.hasOverride ? (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      Override active
                    </span>
                  ) : null}
                </div>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={lesson.title}
                  onChange={(e) =>
                    setStaticLessons((rows) =>
                      rows.map((row) => (row.lessonId === lesson.lessonId ? { ...row, title: e.target.value } : row)),
                    )
                  }
                />
                <textarea
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={lesson.summary}
                  onChange={(e) =>
                    setStaticLessons((rows) =>
                      rows.map((row) =>
                        row.lessonId === lesson.lessonId ? { ...row, summary: e.target.value } : row,
                      ),
                    )
                  }
                />
                <textarea
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  placeholder="Key points (one per line)"
                  value={lesson.keyPointsText}
                  onChange={(e) =>
                    setStaticLessons((rows) =>
                      rows.map((row) =>
                        row.lessonId === lesson.lessonId ? { ...row, keyPointsText: e.target.value } : row,
                      ),
                    )
                  }
                />
                <textarea
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Worksheet prompt (optional)"
                  value={lesson.worksheetPrompt}
                  onChange={(e) =>
                    setStaticLessons((rows) =>
                      rows.map((row) =>
                        row.lessonId === lesson.lessonId ? { ...row, worksheetPrompt: e.target.value } : row,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => void saveStaticLesson(lesson)}
                  className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loading === `save_static:${lesson.lessonId}` ? "Saving…" : "Save founder override"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

