"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Rocket, X, ArrowRight, LockOpen } from "lucide-react";

const STAGES = ["initialize", "qualify", "deploy", "optimize"];

type Unlock = {
  badge: string;
  title: string;
  subtitle: string;
  items: string[];
  cta: { href: string; label: string };
};

const UNLOCKS: Record<string, Unlock> = {
  qualify: {
    badge: "Stage 2 · Qualify",
    title: "Time to get fundraise-ready",
    subtitle: "Onboarding's done. Here's what just unlocked to prepare your raise.",
    items: ["Readiness score & checklist", "Document checklist", "AI diligence report"],
    cta: { href: "/founder/readiness", label: "Build your readiness" },
  },
  deploy: {
    badge: "Stage 3 · Deploy",
    title: "You're qualified — time to raise",
    subtitle: "Your readiness is approved. Here's your raise toolkit.",
    items: ["Investor matching & outreach", "Deal rooms", "Capital raise & SPVs", "Reg CF materials"],
    cta: { href: "/founder/investors", label: "Review your investor matches" },
  },
  optimize: {
    badge: "Stage 4 · Optimize",
    title: "Post-raise tools are open",
    subtitle: "Keep your investors close and your momentum going.",
    items: ["Investor updates", "Milestones", "Analytics"],
    cta: { href: "/founder/updates", label: "Send an investor update" },
  },
};

/** Shows once when a founder reaches a new stage; dismiss persists server-side. */
export function StageUnlockBanner() {
  const t = useTranslations("founderCmp");
  const [stage, setStage] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/founder/journey/stage-unlock");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const cur: string = data.stage ?? "initialize";
        const ack: string = data.acknowledged ?? "initialize";
        if (UNLOCKS[cur] && STAGES.indexOf(cur) > STAGES.indexOf(ack)) {
          setStage(cur);
          setHidden(false);
        }
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);

  const dismiss = useCallback(() => {
    setHidden(true);
    void fetch("/api/founder/journey/stage-unlock", { method: "POST" }).catch(() => {});
  }, []);

  if (hidden || !stage) return null;
  const u = UNLOCKS[stage];

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-[#CECBF6] bg-[#F4F3FE]">
      <div className="flex items-start gap-3 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2E78F5] text-white"><Rocket className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EEEDFE] px-2 py-0.5 text-[11px] font-medium text-[#1A6CE4]">{u.badge}</span>
          <p className="mt-1.5 text-base font-semibold text-slate-950">{u.title}</p>
          <p className="text-sm text-slate-600">{u.subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {u.items.map((it) => (
              <span key={it} className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs text-slate-700 ring-1 ring-inset ring-[#CECBF6]">
                <LockOpen className="h-3.5 w-3.5 text-[#0F6E56]" /> {it}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Link href={u.cta.href} onClick={dismiss} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E78F5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A6CE4]">
              {u.cta.label} <ArrowRight className="h-4 w-4" />
            </Link>
            <button type="button" onClick={dismiss} className="text-sm text-slate-500 hover:text-slate-800">{t("got_it")}</button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded p-1 text-slate-400 hover:bg-white/60 hover:text-slate-700"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
