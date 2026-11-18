"use client";

import Link from "next/link";
import { useState } from "react";
import { Linkedin, X } from "lucide-react";
import { CONNECT_PATH } from "@/lib/social/connect-nudge-rules";

/**
 * Founder home: one banner asking a paid founder to connect with investors. The
 * server decides whether to render it (plan, no connected account, not snoozed,
 * admin switch on). "Remind me later" and the close button both hide it for 7 days.
 */
export function SocialConnectNudge() {
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
      aria-label="Connect with investors"
      className="mb-4 rounded-xl border border-[#BFD4F6] bg-[#F2F7FF] p-3"
    >
      <div className="flex items-start gap-3">
        <Linkedin className="mt-0.5 h-5 w-5 shrink-0 text-[#1A6CE4]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0A1A40]">Connect with investors</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Post once to LinkedIn and grow an investor network that fits your raise. Your draft is ready.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={CONNECT_PATH}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#1A6CE4] px-4 text-sm font-semibold text-white hover:bg-[#2E78F5]"
            >
              Connect LinkedIn
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
          aria-label="Close the Connect with investors reminder"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
