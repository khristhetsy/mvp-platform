"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { searchLessons, type LessonSearchResult } from "@/lib/learning/search";

export function LessonSearch() {
  const t = useTranslations("founderCmp");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LessonSearchResult[]>([]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length >= 2) {
      setResults(searchLessons(value));
    } else {
      setResults([]);
    }
  }

  return (
    <div className="relative mb-6">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="search"
          placeholder={t("search_lessons_cap_table_term_sheet_pitch_de")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="flex-1 text-sm outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            ✕
          </button>
        ) : null}
      </div>

      {results.length > 0 ? (
        <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-md">
          {results.map((result) => (
            <Link
              key={`${result.href}-${result.lessonId}`}
              href={result.href}
              className="block border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-900">{result.lessonTitle}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {result.programTitle} · {result.moduleTitle}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{result.lessonSummary}</p>
            </Link>
          ))}
        </div>
      ) : null}

      {query.length >= 2 && results.length === 0 ? (
        <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          No lessons found for &quot;{query}&quot; — try cap table, term sheet, or pitch deck
        </div>
      ) : null}
    </div>
  );
}
