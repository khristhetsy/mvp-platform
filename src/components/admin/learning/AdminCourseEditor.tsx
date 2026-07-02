"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseBannerUpload } from "@/components/admin/learning/CourseBannerUpload";
import { formatApiError } from "@/lib/api/errors";

export type LearningContentStatus = "draft" | "pending_review" | "approved" | "published" | "archived";
export type LearningDifficulty = "introductory" | "intermediate" | "advanced";

export type ProgramRow = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  readiness_focus: string;
  category?: string | null;
  difficulty?: string | null;
  content_status?: string | null;
  is_published?: boolean | null;
  order_index?: number | null;
  banner_image_url?: string | null;
  video_url?: string | null;
};

type Props = {
  mode: "create" | "edit";
  initial: ProgramRow;
  onSaved?: (program: ProgramRow) => void;
};

const STATUS: LearningContentStatus[] = ["draft", "pending_review", "approved", "published", "archived"];
const DIFFICULTY: LearningDifficulty[] = ["introductory", "intermediate", "advanced"];

const READINESS_FOCUS_OPTIONS = [
  { value: "stage_0", label: "Stage 0 — Foundation (Pre-fundraise basics)" },
  { value: "stage_1", label: "Stage 1 — Seed Round (Early-stage fundraising)" },
  { value: "stage_2", label: "Stage 2 — Series A (Institutional fundraising)" },
  { value: "stage_3", label: "Stage 3 — Exit (Exit planning & execution)" },
  { value: "general", label: "General (not tied to a specific stage)" },
];

const LESSON_COUNT_OPTIONS = [3, 5, 7, 10];

export function AdminCourseEditor({ mode, initial, onSaved }: Props) {
  const t = useTranslations("adminCmp");
  const router = useRouter();
  const [form, setForm] = useState<ProgramRow>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AI generation state — create mode only
  const [buildMode, setBuildMode] = useState<"manual" | "ai">("manual");
  const [aiForm, setAiForm] = useState<{
    lessonCount: number;
    topicFocus: string;
    includeQuiz: boolean;
  }>({ lessonCount: 5, topicFocus: "", includeQuiz: true });

  const effectiveStatus = (form.content_status ?? "draft") as LearningContentStatus;

  const isPublishedDerived = useMemo(() => {
    if (typeof form.is_published === "boolean") return form.is_published;
    return effectiveStatus === "published";
  }, [form.is_published, effectiveStatus]);

  // ── Manual save ────────────────────────────────────────────────────────────

  async function save() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      slug: form.slug,
      title: form.title,
      description: form.description,
      readiness_focus: form.readiness_focus,
      category: form.category ?? null,
      difficulty: (form.difficulty ?? "intermediate") as LearningDifficulty,
      content_status: effectiveStatus,
      is_published: isPublishedDerived,
      order_index: typeof form.order_index === "number" ? form.order_index : 0,
      banner_image_url: form.banner_image_url ?? null,
      video_url: form.video_url?.trim() || null,
    };

    const path =
      mode === "create"
        ? "/api/admin/learning/courses"
        : `/api/admin/learning/courses/${encodeURIComponent(String(form.id))}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw json;
      const program = json.program ? (json.program as ProgramRow) : undefined;
      setSuccess(mode === "create" ? "Course created." : "Course saved.");
      if (program) {
        onSaved?.(program);
      }
      router.refresh();
      if (mode === "create" && program?.id) {
        router.push(`/admin/learning/courses/${program.id}`);
      }
    } catch (e) {
      setError(formatApiError(e, "Unable to save course."));
    } finally {
      setLoading(false);
    }
  }

  // ── AI generation ──────────────────────────────────────────────────────────

  async function generateCourse() {
    if (!form.title.trim()) {
      setError("Course title is required before generating.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/learning/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          readiness_focus: form.readiness_focus,
          lessonCount: aiForm.lessonCount,
          topicFocus: aiForm.topicFocus.trim() || undefined,
          includeQuiz: aiForm.includeQuiz,
          difficulty: (form.difficulty ?? "intermediate") as LearningDifficulty,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw json;
      const courseId = json.courseId as string;
      router.push(`/admin/learning/courses/${courseId}`);
    } catch (e) {
      setError(formatApiError(e, "AI generation failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Educational content only. No investment, legal, or tax advice. No guarantee of funding outcomes.
      </div>

      {/* Build mode selector — create mode only */}
      {mode === "create" && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">{t("how_to_build")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setBuildMode("manual")}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                buildMode === "manual"
                  ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  buildMode === "manual" ? "border-indigo-600" : "border-slate-300"
                }`}
              >
                {buildMode === "manual" && (
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("build_manually")}</p>
                <p className="mt-0.5 text-xs text-slate-500">{t("add_lessons_and_content_yourself")}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setBuildMode("ai")}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                buildMode === "ai"
                  ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  buildMode === "ai" ? "border-indigo-600" : "border-slate-300"
                }`}
              >
                {buildMode === "ai" && (
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                )}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{t("generate_with_ai")}</p>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                    NEW
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  AI writes all lessons, content &amp; quizzes
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── AI generation form ── */}
      {mode === "create" && buildMode === "ai" ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm">
            <span className="text-slate-600">{t("course_title")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder={t("e_g_fundraise_story_pitch_framing")}
              value={form.title}
              onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">{t("capital_stage")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.readiness_focus}
                onChange={(e) => setForm((v) => ({ ...v, readiness_focus: e.target.value }))}
              >
                {READINESS_FOCUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-slate-600">{t("difficulty")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={(form.difficulty ?? "intermediate") as LearningDifficulty}
                onChange={(e) => setForm((v) => ({ ...v, difficulty: e.target.value }))}
              >
                {DIFFICULTY.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">{t("lessons_to_generate")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={aiForm.lessonCount}
                onChange={(e) =>
                  setAiForm((v) => ({ ...v, lessonCount: Number(e.target.value) }))
                }
              >
                {LESSON_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} lessons
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 text-sm" style={{ marginTop: "auto" }}>
              <input
                type="checkbox"
                checked={aiForm.includeQuiz}
                onChange={(e) =>
                  setAiForm((v) => ({ ...v, includeQuiz: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span className="text-slate-700">{t("include_quiz_per_lesson")}</span>
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-slate-600">{t("topic_focus")}</span>
            <p className="text-xs text-slate-400">
              Optional — describe what the course should specifically cover
            </p>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder={t("e_g_how_to_frame_a_compelling_raise_narrativ")}
              value={aiForm.topicFocus}
              onChange={(e) => setAiForm((v) => ({ ...v, topicFocus: e.target.value }))}
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void generateCourse()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generating… this may take 20–30 seconds
              </>
            ) : (
              "✦ Generate course"
            )}
          </button>
        </div>
      ) : (
        /* ── Manual build form (unchanged) ── */
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm text-slate-600">{t("course_banner")}</p>
              <CourseBannerUpload
                value={form.banner_image_url ?? null}
                onUpload={(url) => setForm((current) => ({ ...current, banner_image_url: url }))}
                onRemove={() => setForm((current) => ({ ...current, banner_image_url: null }))}
              />
            </div>
            <div>
              <p className="mb-2 text-sm text-slate-600">{t("live_preview")}</p>
              <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="h-36 bg-slate-100">
                  {form.banner_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.banner_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-100 to-slate-200 text-xs text-slate-500">
                      Banner preview
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-base font-semibold text-slate-950">{form.title || "Course title"}</p>
                  <p className="mt-1 text-xs capitalize text-slate-500">{form.difficulty ?? "intermediate"}</p>
                </div>
              </article>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">{t("title")}</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">{t("slug")}</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                value={form.slug}
                onChange={(e) => setForm((v) => ({ ...v, slug: e.target.value }))}
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-slate-600">{t("description")}</span>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-600">{t("course_video_url")}</span>
            <p className="mb-1 text-xs text-slate-400">{t("youtube_vimeo_or_direct_mp4_url_shown_on_les")}</p>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="https://www.youtube.com/watch?v=..."
              value={form.video_url ?? ""}
              onChange={(e) => setForm((v) => ({ ...v, video_url: e.target.value }))}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="text-slate-600">{t("capital_stage")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.readiness_focus}
                onChange={(e) => setForm((v) => ({ ...v, readiness_focus: e.target.value }))}
              >
                {READINESS_FOCUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">{t("category")}</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.category ?? ""}
                onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">{t("difficulty")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={(form.difficulty ?? "intermediate") as LearningDifficulty}
                onChange={(e) => setForm((v) => ({ ...v, difficulty: e.target.value }))}
              >
                {DIFFICULTY.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="text-slate-600">{t("content_status")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={effectiveStatus}
                onChange={(e) => setForm((v) => ({ ...v, content_status: e.target.value }))}
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-slate-600">{t("published")}</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={isPublishedDerived ? "yes" : "no"}
                onChange={(e) => setForm((v) => ({ ...v, is_published: e.target.value === "yes" }))}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-slate-600">{t("order")}</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={typeof form.order_index === "number" ? form.order_index : 0}
                onChange={(e) => setForm((v) => ({ ...v, order_index: Number(e.target.value) }))}
              />
            </label>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {success}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Saving…" : mode === "create" ? "Create course" : "Save changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
