"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ActionCenterScheduledContext } from "@/lib/notifications/scheduled/types";

export function ActionCenterScheduledStrip({
  scheduled,
}: Readonly<{ scheduled: ActionCenterScheduledContext }>) {
  const t = useTranslations("sharedCmp");
  const { digestBanner, recentlyReminded, returningFromSnooze, needsFollowUp } = scheduled;
  const hasContent =
    digestBanner || recentlyReminded.length > 0 || returningFromSnooze.length > 0 || needsFollowUp.length > 0;

  if (!hasContent) return null;

  const hasStrip = returningFromSnooze.length > 0 || needsFollowUp.length > 0 || recentlyReminded.length > 0;

  return (
    <div className="space-y-3">
      {digestBanner ? (
        <Link
          href={digestBanner.deepLink}
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition-all hover:border-slate-400 hover:shadow-sm"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm">
            📋
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("weekly_digest")}</p>
            <p className="text-sm font-semibold text-slate-900">{digestBanner.title}</p>
            <p className="text-xs text-slate-500">{digestBanner.summary}</p>
          </div>
          <span className="shrink-0 text-base text-slate-300">→</span>
        </Link>
      ) : null}

      {hasStrip ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {returningFromSnooze.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">↩ Returning from snooze</p>
              <ul className="mt-1.5 space-y-1">
                {returningFromSnooze.map((item) => (
                  <li key={item.id}>
                    <Link href={item.deepLink} className="line-clamp-1 text-xs text-slate-700 hover:underline">
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {needsFollowUp.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">⚠ Needs follow-up</p>
              <ul className="mt-1.5 space-y-1">
                {needsFollowUp.map((item) => (
                  <li key={item.id}>
                    <Link href={item.deepLink} className="line-clamp-1 text-xs text-slate-700 hover:underline">
                      {item.title}{" "}
                      <span className="text-slate-400">({item.reason})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {recentlyReminded.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">🕐 Recently reminded</p>
              <ul className="mt-1.5 space-y-1">
                {recentlyReminded.map((item, i) => (
                  <li key={`${item.title}-${i}`}>
                    {item.deepLink ? (
                      <Link href={item.deepLink} className="line-clamp-1 text-xs text-slate-700 hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      <span className="line-clamp-1 text-xs text-slate-700">{item.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
