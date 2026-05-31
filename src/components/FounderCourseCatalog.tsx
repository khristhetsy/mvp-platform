"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { FounderCourseCatalogItem } from "@/lib/learning/load-founder-courses";

export function FounderCourseCatalog({
  courses,
  categories,
  overallPercent,
}: Readonly<{
  courses: FounderCourseCatalogItem[];
  categories: string[];
  overallPercent: number;
}>) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((course) => {
      if (category !== "all" && course.category !== category) return false;
      if (!q) return true;
      return (
        course.title.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q) ||
        course.instructor.toLowerCase().includes(q) ||
        course.category.toLowerCase().includes(q)
      );
    });
  }, [courses, query, category]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CapitalOS founder academy"
        title="Online courses"
        description="Educational founder training — investor preparation and learning progress. Not legal, tax, securities, or investment advice."
        metadata={`${courses.length} courses · ${overallPercent}% overall learning progress`}
      />

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search courses…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2 sm:max-w-md"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-600">No courses match your search.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <article
              key={course.slug}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-panel)]"
            >
              <div
                className={`flex h-36 items-end bg-gradient-to-br ${course.thumbnailAccent} p-4`}
              >
                <span className="rounded bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {course.category}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[11px] text-slate-500">{course.instructor}</p>
                <h2 className="mt-1 text-base font-semibold text-slate-950">{course.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{course.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <StatusBadge label={course.level} status="neutral" />
                  <span>{course.durationLabel}</span>
                  <span>{course.lessonCount} lessons</span>
                </div>
                {course.hasStarted ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Course completion</span>
                      <span>{course.percentComplete}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${course.percentComplete}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.hasStarted && course.continueHref ? (
                    <Link
                      href={course.continueHref}
                      className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Continue
                    </Link>
                  ) : null}
                  <Link
                    href={course.href}
                    className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {course.hasStarted ? "Course page" : "Start course"}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
