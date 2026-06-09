"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function QuizReviewBanner() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/founder/learning/quiz-review");
        if (!res.ok) return;
        const json = (await res.json()) as { count?: number };
        setCount(json.count ?? 0);
      } catch {
        // ignore
      }
    })();
  }, []);

  if (count <= 0) return null;

  return (
    <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm font-medium text-amber-900">
          {count} quiz question{count > 1 ? "s" : ""} due for review
        </p>
      </div>
      <Link href="/founder/learning?review=true" className="text-xs font-semibold text-amber-700">
        Review now →
      </Link>
    </div>
  );
}
