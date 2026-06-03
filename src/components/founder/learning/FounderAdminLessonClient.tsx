"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/api/errors";

export function FounderAdminLessonClient({
  courseId,
  lessonId,
  moduleSlug,
  lessonKey,
}: {
  courseId: string;
  lessonId: string;
  moduleSlug: string;
  lessonKey: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function markComplete() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/founder/learning/admin-courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleSlug, lessonKey }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw json;
      setSuccess(json?.certificateIssued ? "Lesson completed. Certificate issued." : "Lesson completed.");
      router.refresh();
    } catch (e) {
      setError(formatApiError(e, "Unable to mark lesson complete."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      {error ? <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}
      {success ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void markComplete()}
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Mark lesson complete"}
      </button>
    </div>
  );
}

