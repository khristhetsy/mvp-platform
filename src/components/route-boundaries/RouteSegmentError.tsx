"use client";

import Link from "next/link";
import { useEffect } from "react";

type RouteSegmentErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
  eyebrow: string;
  title?: string;
  description?: string;
  homeHref: string;
  homeLabel: string;
}>;

export function RouteSegmentError({
  error,
  reset,
  eyebrow,
  title = "Something went wrong",
  description = "We couldn't load this page right now. Please try again — your data is safe.",
  homeHref,
  homeLabel,
}: RouteSegmentErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 enterprise-animate-in lg:px-6">
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-panel)] lg:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 lg:text-[1.65rem]">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Try again
          </button>
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
