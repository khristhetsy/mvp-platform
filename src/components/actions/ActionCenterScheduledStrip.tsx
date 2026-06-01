"use client";

import Link from "next/link";
import type { ActionCenterScheduledContext } from "@/lib/notifications/scheduled/types";

export function ActionCenterScheduledStrip({
  scheduled,
}: Readonly<{ scheduled: ActionCenterScheduledContext }>) {
  const { digestBanner, recentlyReminded, returningFromSnooze, needsFollowUp } = scheduled;
  const hasContent =
    digestBanner || recentlyReminded.length > 0 || returningFromSnooze.length > 0 || needsFollowUp.length > 0;

  if (!hasContent) return null;

  return (
    <div className="space-y-3">
      {digestBanner ? (
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Digest summary</p>
              <p className="mt-1 text-sm font-medium text-[var(--navy)]">{digestBanner.title}</p>
              <p className="mt-0.5 text-xs text-indigo-900/80">{digestBanner.summary}</p>
            </div>
            <Link
              href={digestBanner.deepLink}
              className="shrink-0 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
            >
              Open actions
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {returningFromSnooze.length > 0 ? (
          <div className="rounded-lg border border-violet-200/80 bg-violet-50/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-violet-800">Returning from snooze</p>
            <ul className="mt-1 space-y-1">
              {returningFromSnooze.map((item) => (
                <li key={item.id}>
                  <Link href={item.deepLink} className="text-xs text-violet-900 hover:underline line-clamp-1">
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {needsFollowUp.length > 0 ? (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-amber-900">Needs follow-up</p>
            <ul className="mt-1 space-y-1">
              {needsFollowUp.map((item) => (
                <li key={item.id}>
                  <Link href={item.deepLink} className="text-xs text-amber-950 hover:underline line-clamp-1">
                    {item.title} <span className="text-amber-700">({item.reason})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {recentlyReminded.length > 0 ? (
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-slate-600">Recently reminded</p>
            <ul className="mt-1 space-y-1">
              {recentlyReminded.map((item, i) => (
                <li key={`${item.title}-${i}`}>
                  {item.deepLink ? (
                    <Link href={item.deepLink} className="text-xs text-slate-700 hover:underline line-clamp-1">
                      {item.title}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-700 line-clamp-1">{item.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
