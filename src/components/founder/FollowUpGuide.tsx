"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, CalendarCheck, ChevronUp, HelpCircle, Mail, Users } from "lucide-react";

/**
 * "How following up works": four steps, each with a mini screen showing where
 * to tap (indigo ring and dot) and what happens next. Open until the founder
 * sends a first follow up, then it collapses to a link. Purely visual.
 */

function Tap({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-flex rounded-md outline outline-2 outline-offset-2 outline-indigo-400">
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
    title: "Pick your event",
    desc: "Choose the event you matched at. You only see investors who said yes to meeting you.",
    screens: (
      <Screens
        tap={
          <Mini caption="Tap">
            <Tap>
              <span className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5">Your event</span>
            </Tap>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <p className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" /> Investors who accepted
            </p>
          </Mini>
        }
      />
    ),
  },
  {
    title: "See who to follow up",
    desc: "Each row shows whether a time is booked and how many follow ups you have sent.",
    screens: (
      <Screens
        tap={
          <Mini caption="Look">
            <p>
              Investor A <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">No time yet</span>
            </p>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <p className="text-slate-500">Follow ups 0 of 2</p>
          </Mini>
        }
      />
    ),
  },
  {
    title: "Tap Follow up",
    desc: "We email the investor a Book a time link to your scheduling page. The link works for 30 days from each email, even after the event.",
    screens: (
      <Screens
        tap={
          <Mini caption="Tap">
            <Tap>
              <span className={PRIMARY}>
                <Mail className="h-3 w-3" aria-hidden="true" /> Follow up
              </span>
            </Tap>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <p className="text-slate-500">Email sent</p>
            <p className="text-indigo-600">Book a time</p>
          </Mini>
        }
      />
    ),
  },
  {
    title: "They book, you meet",
    desc: "When the investor picks a time, the row shows Booked and the follow ups stop. You can send two follow ups, and we also send up to two for you.",
    screens: (
      <Screens
        tap={
          <Mini caption="Watch">
            <p>
              Investor A <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">Booked</span>
            </p>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <p className="flex items-center gap-1 text-slate-600">
              <CalendarCheck className="h-3 w-3" aria-hidden="true" /> On your calendar
            </p>
          </Mini>
        }
      />
    ),
  },
];

export function FollowUpGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
        How following up works
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <HelpCircle className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          How following up works
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
