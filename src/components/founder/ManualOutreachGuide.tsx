"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Database,
  HelpCircle,
  Mail,
  Search,
  Sparkles,
  Square,
  X,
} from "lucide-react";

/**
 * "How manual outreach works": five steps, each with a mini screen showing where
 * to tap (blue ring and dot) and what you'll see next. Open by default until the
 * founder sends their first manual email, then it collapses to a link.
 * Purely visual: nothing here sends or saves.
 */

function Tap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-flex rounded-md outline outline-2 outline-offset-2 outline-indigo-400 ${className}`}>
      {children}
      <span className="absolute -bottom-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-indigo-600" aria-hidden="true" />
    </span>
  );
}

function Mini({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="min-h-[72px] rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{caption}</p>
      {children}
    </div>
  );
}

function Screens({ tap, then }: { tap: ReactNode; then: ReactNode }) {
  return (
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-1.5">
      {tap}
      <ArrowRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
      {then}
    </div>
  );
}

const PRIMARY = "inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-0.5 text-white";

const STEPS: { title: string; desc: string; screens: ReactNode }[] = [
  {
    title: "Add investors you know",
    desc: "Tap New and enter their name and email, or pull them from My contacts. It's the same address book.",
    screens: (
      <Screens
        tap={
          <Mini caption="Tap">
            <div className="flex items-center gap-2">
              <Tap>
                <span className={PRIMARY}>New</span>
              </Tap>
              <span className="text-slate-500">2 investors</span>
            </div>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <div className="mb-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-400">Name</div>
            <div className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-400">Email</div>
          </Mini>
        }
      />
    ),
  },
  {
    title: "Search and filter",
    desc: "Type a name, or open the arrow to filter by Source, tag, or status.",
    screens: (
      <Screens
        tap={
          <Mini caption="Tap">
            <div className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-1.5 py-1">
              <Search className="h-3 w-3" aria-hidden="true" />
              <span className="flex-1" />
              <Tap>
                <ChevronDown className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
              </Tap>
            </div>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
              <Database className="h-3 w-3" aria-hidden="true" /> Source <X className="h-3 w-3" aria-hidden="true" />
            </span>
            <p className="mt-1 text-slate-500">Not contacted</p>
          </Mini>
        }
      />
    ),
  },
  {
    title: "Tick who to contact",
    desc: "Check rows one by one, or use Select all.",
    screens: (
      <Screens
        tap={
          <Mini caption="Tap">
            <div className="flex items-center gap-1.5 py-0.5">
              <Tap>
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
              </Tap>
              Investor A
            </div>
            <div className="flex items-center gap-1.5 py-0.5">
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              Investor B
            </div>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">1 selected</span>
            <p className="mt-1 flex items-center gap-1 text-indigo-600">
              <CheckSquare className="h-3 w-3" aria-hidden="true" /> Select all 2
            </p>
          </Mini>
        }
      />
    ),
  },
  {
    title: "Send email",
    desc: "Pick a template or Draft with AI. Review and edit, then send.",
    screens: (
      <Screens
        tap={
          <Mini caption="Tap">
            <Tap>
              <span className={PRIMARY}>
                <Mail className="h-3 w-3" aria-hidden="true" /> Send email
              </span>
            </Tap>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <p className="text-slate-500">
              Template <ChevronDown className="inline h-3 w-3" aria-hidden="true" />
            </p>
            <p className="flex items-center gap-1 text-indigo-600">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Draft with AI
            </p>
            <span className={`${PRIMARY} mt-1`}>Send</span>
          </Mini>
        }
      />
    ),
  },
  {
    title: "Track replies",
    desc: "Each row updates as investors engage: Sent, Opened, Clicked, Replied. Move warm investors to your Investor CRM.",
    screens: (
      <Screens
        tap={
          <Mini caption="Watch">
            <p>
              Investor A <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">Replied</span>
            </p>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <Tap>
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5">
                Actions <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </span>
            </Tap>
            <p className="mt-1.5 text-slate-500">Move to CRM</p>
          </Mini>
        }
      />
    ),
  },
];

export function ManualOutreachGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
        How manual outreach works
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <HelpCircle className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          How manual outreach works
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          Hide <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <ol className="space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">{s.title}</p>
              <p className="text-xs leading-relaxed text-slate-500">{s.desc}</p>
              {s.screens}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
