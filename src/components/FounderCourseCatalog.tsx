"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FloatingFounderAICoach } from "@/components/FloatingFounderAICoach";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { FounderCourseCatalogItem } from "@/lib/learning/load-founder-courses";

type CategoryStyle = {
  bg: string;
  iconColor: string;
  svg: React.ReactNode;
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  "investor-readiness": {
    bg: "#dbeafe",
    iconColor: "#1d4ed8",
    svg: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
      </svg>
    ),
  },
  fundraising: {
    bg: "#ede9fe",
    iconColor: "#6d28d9",
    svg: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  finance: {
    bg: "#ccfbf1",
    iconColor: "#0f766e",
    svg: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  diligence: {
    bg: "#fef3c7",
    iconColor: "#b45309",
    svg: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M9 3a1 1 0 012 0v5.5a.5.5 0 001 0V4a1 1 0 112 0v4.5a.5.5 0 001 0V6a1 1 0 112 0v5a7 7 0 11-14 0V9a1 1 0 012 0v2.5a.5.5 0 001 0V4a1 1 0 012 0v4.5a.5.5 0 001 0V3z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  governance: {
    bg: "#e0e7ff",
    iconColor: "#4338ca",
    svg: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  communication: {
    bg: "#ffe4e6",
    iconColor: "#be123c",
    svg: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

function getCategoryStyle(category: string): CategoryStyle {
  const key = category.toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  return (
    CATEGORY_STYLES[key] ?? {
      bg: "#f1f5f9",
      iconColor: "#475569",
      svg: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
        </svg>
      ),
    }
  );
}

function formatCategoryLabel(category: string): string {
  return category
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
        eyebrow="iCapOS founder academy"
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
          className="w-full flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--blue)] focus:ring-2 sm:max-w-md"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {formatCategoryLabel(cat)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-600">No courses match your search.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => {
            const catStyle = getCategoryStyle(course.category);
            return (
              <article
                key={course.slug}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-panel)]"
              >
                {/* Card header */}
                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: catStyle.bg, color: catStyle.iconColor }}
                  >
                    {catStyle.svg}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-700">
                      {formatCategoryLabel(course.category)}
                    </p>
                    <p className="text-[11px] text-slate-400">iCapOS Core</p>
                  </div>
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[11px] text-slate-500">{course.instructor}</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">{course.title}</h2>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{course.description}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                    <StatusBadge label={course.level} status="neutral" />
                    <span className="text-slate-300">·</span>
                    <span>{course.durationLabel}</span>
                    <span className="text-slate-300">·</span>
                    <span>{course.lessonCount} lessons</span>
                  </div>

                  {/* Progress bar — always shown */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Course completion</span>
                      <span>{course.hasStarted ? `${course.percentComplete}%` : "Not started"}</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                      {course.hasStarted ? (
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${course.percentComplete}%`,
                            backgroundColor: "var(--blue, #2563eb)",
                          }}
                        />
                      ) : null}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="mt-4 flex gap-2">
                    {course.hasStarted && course.continueHref ? (
                      <>
                        <Link
                          href={course.continueHref}
                          className="flex-1 rounded-md bg-[#2563eb] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#1d4ed8]"
                        >
                          Continue
                        </Link>
                        <Link
                          href={course.href}
                          className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Course page
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={course.href}
                        className="flex-1 rounded-md bg-[#2563eb] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#1d4ed8]"
                      >
                        Start course
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <FloatingFounderAICoach />
    </div>
  );
}
