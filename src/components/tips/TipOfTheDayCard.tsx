"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lightbulb, X } from "lucide-react";
import type { Tip } from "@/lib/tips/library";

export function TipOfTheDayCard({ tip }: Readonly<{ tip: Tip }>) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  async function act(action: "dismiss" | "disable") {
    setHidden(true);
    try {
      await fetch("/api/preferences/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    } catch {
      // Non-critical — the card is already hidden locally.
    }
    router.refresh();
  }

  return (
    <div className="mb-5 flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
        <Lightbulb className="h-5 w-5 text-indigo-500" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-indigo-700">Tip of the day</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-indigo-600">
            {tip.context}
          </span>
        </div>
        <p className="mt-1 text-[13px] leading-6 text-slate-700">{tip.body}</p>
        <div className="mt-2 flex items-center gap-4">
          {tip.actionHref ? (
            <Link href={tip.actionHref} className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
              {tip.actionLabel ?? "Learn more"} →
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => act("disable")}
            className="text-xs text-slate-400 transition-colors hover:text-slate-600"
          >
            Turn off tips
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => act("dismiss")}
        aria-label="Dismiss today's tip"
        className="h-fit shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
