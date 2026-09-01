"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Compass,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Sparkles,
  LifeBuoy,
  X,
  type LucideIcon,
} from "lucide-react";

// Fired by the Help page ("Take the tour") to re-open the tour on demand.
export const FOUNDER_TOUR_EVENT = "icapos-founder-tour:open";
const SEEN_KEY = "icapos.founderTourSeen.v1";

type Step = { icon: LucideIcon; title: string; body: string };

const STEPS: Step[] = [
  {
    icon: Compass,
    title: "Welcome to iCapOS",
    body: "This is your fundraising workspace. Your raise runs in four stages — we'll point out the essentials in a few quick steps.",
  },
  {
    icon: LayoutDashboard,
    title: "Your four stages, in order",
    body: "The left sidebar follows your raise: Onboarding → Preparation → Marketing → Closing. Each stage opens the tools for that step.",
  },
  {
    icon: ListChecks,
    title: "Always know the next move",
    body: "Your Dashboard shows one clear next action and your progress at a glance, so you never wonder what to do next.",
  },
  {
    icon: Megaphone,
    title: "Get in front of investors",
    body: "In Stage 3, matched investors, automated outreach, and your CRM live together — that's where your raise gets in front of the right people.",
  },
  {
    icon: Sparkles,
    title: "The AI assistant is everywhere",
    body: "The spark button, bottom-right, opens an assistant that adapts to the page you're on. Ask it anything about what's in front of you.",
  },
  {
    icon: LifeBuoy,
    title: "Guidance whenever you need it",
    body: "Every stage has a step-by-step guide, and the Help page collects them all. You can reopen this tour from there anytime.",
  },
];

export function FounderTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  // First-run: open once if never seen. Guarded so SSR never triggers it.
  // Deferred to a microtask so the open isn't a synchronous setState in the effect.
  useEffect(() => {
    let unseen = false;
    try { unseen = !window.localStorage.getItem(SEEN_KEY); } catch { unseen = false; }
    if (!unseen) return;
    const id = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Re-open on demand (Help page button).
  useEffect(() => {
    const onOpen = () => { setI(0); setOpen(true); };
    window.addEventListener(FOUNDER_TOUR_EVENT, onOpen);
    return () => window.removeEventListener(FOUNDER_TOUR_EVENT, onOpen);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try { window.localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const step = STEPS[i];
  const Icon = step.icon;
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Getting started tour">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-indigo,#2E78F5)]/10 text-[var(--brand-indigo,#2E78F5)]">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <button type="button" onClick={close} aria-label="Close tour" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-2 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Step {i + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary,#0c2340)]">{step.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {STEPS.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 w-1.5 rounded-full ${n === i ? "bg-[var(--brand-indigo,#2E78F5)]" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI((n) => Math.max(n - 1, 0))}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Back
              </button>
            )}
            {!last ? (
              <>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => setI((n) => Math.min(n + 1, STEPS.length - 1))}
                  className="rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Next
                </button>
              </>
            ) : (
              <Link
                href="/founder/help"
                onClick={close}
                className="rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Explore guides
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
