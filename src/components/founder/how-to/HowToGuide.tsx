"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ArrowRight, CheckSquare, ChevronUp, HelpCircle } from "lucide-react";
import type { HowToGuideData, HowToStep } from "@/lib/founder/how-to-types";

/**
 * A "how to use" card in the same style as the manual outreach guide: numbered
 * steps, each with a mini screen showing what to tap (blue ring and dot) and
 * what you'll see next. Closed by default: a small link opens it, and
 * Hide closes it again. The choice is remembered in this browser. Purely visual:
 * nothing here sends or saves.
 */

// Closed until the founder opens it. A new key, so old "hidden" flags do not matter.
const STORAGE_PREFIX = "icapos.howto.open.";

function readOpen(key: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();

function writeOpen(key: string, open: boolean) {
  try {
    if (open) window.localStorage.setItem(STORAGE_PREFIX + key, "1");
    else window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* storage can be blocked; the card then simply reopens next visit */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function Tap({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-flex max-w-full rounded-md outline outline-2 outline-offset-2 outline-indigo-400">
      {children}
      <span className="absolute -bottom-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-indigo-600" aria-hidden="true" />
    </span>
  );
}

function Mini({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="min-h-[64px] min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
      <p className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-400">{caption}</p>
      {children}
    </div>
  );
}

function TapView({ tap }: { tap: HowToStep["tap"] }) {
  switch (tap.kind) {
    case "button":
      return (
        <Tap>
          <span className="inline-flex items-center rounded-md bg-indigo-600 px-2 py-0.5 text-white">{tap.label}</span>
        </Tap>
      );
    case "link":
      return (
        <Tap>
          <span className="px-1 py-0.5 font-medium text-indigo-600 underline">{tap.label}</span>
        </Tap>
      );
    case "field":
      return (
        <Tap>
          <span className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-slate-500">{tap.label}</span>
        </Tap>
      );
    case "check":
      return (
        <Tap>
          <span className="inline-flex items-center gap-1 px-1 py-0.5">
            <CheckSquare className="h-3 w-3 text-indigo-600" aria-hidden="true" />
            {tap.label}
          </span>
        </Tap>
      );
    default:
      return <span className="font-medium text-slate-700">{tap.label}</span>;
  }
}

export function HowToGuide({ guide }: Readonly<{ guide: HowToGuideData }>) {
  // "pending" on the server and until the browser has been asked, so a hidden card never flashes open.
  const state = useSyncExternalStore(
    subscribe,
    () => (readOpen(guide.key) ? "open" : "closed"),
    () => "pending",
  );

  if (state === "pending") return null;
  const open = state === "open";

  if (!open) {
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={() => writeOpen(guide.key, true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
          {guide.title}
        </button>
      </div>
    );
  }

  return (
    <section aria-label={guide.title} className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-900">
          <HelpCircle className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
          <span className="truncate">{guide.title}</span>
        </p>
        <button
          type="button"
          onClick={() => writeOpen(guide.key, false)}
          className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          Hide <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <ol className="space-y-4">
        {guide.steps.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{s.title}</p>
              <p className="text-xs leading-relaxed text-slate-500">{s.desc}</p>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-1.5">
                <Mini caption={s.tap.kind === "watch" ? "Watch" : "Tap"}>
                  <TapView tap={s.tap} />
                </Mini>
                <ArrowRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
                <Mini caption="Then">
                  <p>{s.then}</p>
                </Mini>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
