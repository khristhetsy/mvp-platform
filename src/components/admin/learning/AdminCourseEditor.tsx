"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
};

type Props = {
  mode: "create" | "edit";
  initial: ProgramRow;
  onSaved?: (program: ProgramRow) => void;
};

const STATUS: LearningContentStatus[] = ["draft", "pending_review", "approved", "published", "archived"];
const DIFFICULTY: LearningDifficulty[] = ["introductory", "intermediate", "advanced"];

export function AdminCourseEditor({ mode, initial, onSaved }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProgramRow>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const effectiveStatus = (form.content_status ?? "draft") as LearningContentStatus;

  const isPublishedDerived = useMemo(() => {
    if (typeof form.is_published === "boolean") return form.is_published;
    return effectiveStatus === "published";
  }, [form.is_published, effectiveStatus]);

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
    };

    const path =
      mode === "create" ? "/api/admin/learning/courses" : `/api/admin/learning/courses/${encodeURIComponent(String(form.id))}`;
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

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Educational content only. No investment, legal, or tax advice. No guarantee of funding outcomes.
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-600">Title</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Slug</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            value={form.slug}
            onChange={(e) => setForm((v) => ({ ...v, slug: e.target.value }))}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-slate-600">Description</span>
        <textarea
          rows={4}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={form.description}
          onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-sm">
          <span className="text-slate-600">Readiness focus</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.readiness_focus}
            onChange={(e) => setForm((v) => ({ ...v, readiness_focus: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Category</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.category ?? ""}
            onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Difficulty</span>
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
          <span className="text-slate-600">Content status</span>
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
          <span className="text-slate-600">Published</span>
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
          <span className="text-slate-600">Order</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={typeof form.order_index === "number" ? form.order_index : 0}
            onChange={(e) => setForm((v) => ({ ...v, order_index: Number(e.target.value) }))}
          />
        </label>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</div>
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
    </div>
  );
}

