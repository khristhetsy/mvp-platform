"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { CoachedCourseSummary } from "@/lib/learning/coach/program-summary";

/**
 * The one line playbook reminder on the founder dashboard. The founder can hide it with the close button.
 * The choice is remembered in this browser per playbook and per next step, so it comes back
 * when there is a new step to take rather than staying hidden forever.
 */
function dismissKey(summary: CoachedCourseSummary) {
  return `icapos:playbook-strip-hidden:${summary.courseSlug}:${summary.href}`;
}

const CHANGE_EVENT = "icapos:playbook-strip-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readHidden(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    // Storage can be blocked. The strip simply stays visible.
    return false;
  }
}

export function CoachedCourseStrip({ summary }: Readonly<{ summary: CoachedCourseSummary }>) {
  const key = dismissKey(summary);
  const hidden = useSyncExternalStore(subscribe, () => readHidden(key), () => false);

  if (hidden) return null;

  function hide() {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage is blocked, so the choice cannot be kept.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-[#0A1A40] px-4 py-3 text-white" aria-label="Playbook next step">
      <Link href={summary.href} className="flex min-w-0 flex-1 items-center justify-between gap-4 hover:opacity-90">
        <span className="min-w-0 text-sm leading-6">
          <span className="font-semibold">{summary.title}:</span> {summary.line} <span className="text-[#C9D6F2]">About {summary.nextMinutes} min.</span>
        </span>
        <span className="shrink-0 rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-xs font-semibold hover:bg-[#2E78F5]">Continue</span>
      </Link>
      <button
        type="button"
        onClick={hide}
        aria-label={`Hide ${summary.title} reminder`}
        title="Hide"
        className="shrink-0 rounded-md p-1.5 text-[#C9D6F2] hover:bg-[#14275A] hover:text-white"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </div>
  );
}
