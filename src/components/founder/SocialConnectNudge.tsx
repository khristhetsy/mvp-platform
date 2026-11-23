"use client";

import Link from "next/link";
import { useState } from "react";
import { Linkedin, X } from "lucide-react";
import { LAUNCH_NUDGE_COPY, type LaunchNudgeStep } from "@/lib/social/connect-nudge-rules";

/**
 * Founder home: one banner pointing a paid founder at the next Launch my social media step. The
 * server decides whether to render it (plan, no connected account, not snoozed,
 * admin switch on). "Remind me later" and the close button both hide it for 7 days.
 */
export function SocialConnectNudge({ step }: { step: LaunchNudgeStep }) {
  const copy = LAUNCH_NUDGE_COPY[step];
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function hide(action: "snooze" | "dismiss") {
    setHidden(true);
    void fetch("/api/founder/social/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => undefined);
  }

  return (
    <div
      role="region"
      aria-label="Launch my social media"
      className="mb-4 rounded-xl border border-[#BFD4F6] bg-[#F2F7FF] p-3"
    >
      <div className="flex items-start gap-3">
        <Linkedin className="mt-0.5 h-5 w-5 shrink-0 text-[#1A6CE4]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0A1A40]">Launch my social media</p>
          <p className="mt-0.5 text-sm text-slate-600">
            <b>Step {copy.position} of 4: {copy.title}.</b> {copy.body}
          </p>
          <div className="mt-2 h-1.5 max-w-[280px] rounded-full bg-[#DBE7FB]" aria-hidden><div className="h-1.5 rounded-full bg-[#1A6CE4]" style={{ width: `${copy.percent}%` }} /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={copy.path}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1A6CE4] px-4 text-sm font-semibold text-white hover:bg-[#2E78F5]"
            >
              {copy.cta}
            </Link>
            <button
              type="button"
              onClick={() => hide("snooze")}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Remind me later
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => hide("dismiss")}
          aria-label="Close the Launch my social media reminder"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
