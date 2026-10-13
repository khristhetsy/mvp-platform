"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, CheckSquare, ChevronDown, ChevronUp, HelpCircle, Search, Square } from "lucide-react";

/**
 * "How the Investor directory works": five steps, each with a mini screen showing
 * where to tap (blue ring and dot) and what you'll see next. Same pattern as
 * "How manual outreach works". Open by default until the founder's first
 * directory import, then it folds into a link. Purely visual: nothing here
 * imports or saves.
 */

function Tap({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="relative inline-flex rounded-md outline outline-2 outline-offset-2 outline-indigo-400">
      {children}
      <span className="absolute -bottom-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-indigo-600" aria-hidden="true" />
    </span>
  );
}

function Mini({ caption, children }: Readonly<{ caption: string; children: ReactNode }>) {
  return (
    <div className="min-h-[72px] min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{caption}</p>
      {children}
    </div>
  );
}

function Screens({ tap, then }: Readonly<{ tap: ReactNode; then: ReactNode }>) {
  return (
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-1.5">
      {tap}
      <ArrowRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
      {then}
    </div>
  );
}

const PRIMARY = "inline-flex items-center gap-1 rounded-md bg-[#1A6CE4] px-2 py-0.5 text-white";
const GHOST = "inline-flex items-center rounded-md border border-slate-200 bg-white px-1.5 py-0.5";
const LINE = "flex min-w-0 items-center justify-between gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5";

export type GuideLimits = { basic: number; professional: number; premium: number };

function steps(limits: GuideLimits): { title: string; desc: string; screens: ReactNode }[] {
  const n = (v: number) => v.toLocaleString("en-US");
  return [
    {
      title: "Pick where your investors come from",
      desc: "Each tab is one source. Directory and Form D are public investor records. LinkedIn and CSV or Excel bring in your own contacts from a file.",
      screens: (
        <Screens
          tap={
            <Mini caption="Tap a tab">
              <div className="flex flex-wrap items-center gap-1">
                <span className={GHOST}>Directory</span>
                <span className={GHOST}>Form D</span>
                <Tap><span className={GHOST}>LinkedIn</span></Tap>
                <span className={GHOST}>CSV or Excel</span>
              </div>
            </Mini>
          }
          then={
            <Mini caption="Then">
              <div className={LINE}><span className="truncate">LinkedIn connections</span><span className={PRIMARY}>Import</span></div>
              <p className="mt-1 text-slate-500">Map columns, preview, import</p>
            </Mini>
          }
        />
      ),
    },
    {
      title: "Search and look closer",
      desc: "Search by firm, contact, city or fund. Open a row to see what they invest in, their latest fund and whether they are investing now.",
      screens: (
        <Screens
          tap={
            <Mini caption="Type, then open a row">
              <Tap>
                <span className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-400">
                  <Search className="h-3 w-3" aria-hidden="true" /> Search firm, city, fund
                </span>
              </Tap>
              <div className={`${LINE} mt-1.5`}><span className="truncate">1st Source Capital</span><ChevronDown className="h-3 w-3" aria-hidden="true" /></div>
            </Mini>
          }
          then={
            <Mini caption="Then">
              <p>Invests in: Seed, Series A</p>
              <p className="text-slate-500">Latest fund · Investing now</p>
            </Mini>
          }
        />
      ),
    },
    {
      title: "Tick investors and import them",
      desc: `Tick the ones you want, or Select all, then tap Import to outreach. Every investor you hold counts toward your plan's limit, from any source: Basic holds up to ${n(limits.basic)}, Professional up to ${n(limits.professional)}, Premium up to ${n(limits.premium)}.`,
      screens: (
        <Screens
          tap={
            <Mini caption="Tick, then import">
              <div className="flex items-center gap-1.5 py-0.5"><CheckSquare className="h-3.5 w-3.5 text-[#1A6CE4]" aria-hidden="true" /> 8VC</div>
              <div className="flex items-center gap-1.5 py-0.5"><Square className="h-3.5 w-3.5" aria-hidden="true" /> Accel</div>
              <Tap><span className={PRIMARY}>Import to outreach</span></Tap>
            </Mini>
          }
          then={
            <Mini caption="Then">
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">1 added to Manual outreach</span>
              <p className="mt-1 text-slate-500">Investors held goes up by 1</p>
            </Mini>
          }
        />
      ),
    },
    {
      title: "Accept the terms once",
      desc: "The first time you import, confirm you'll use the data for your own company's fundraising only and won't redistribute it. You won't be asked again.",
      screens: (
        <Screens
          tap={
            <Mini caption="First import only">
              <p className="flex items-center gap-1"><CheckSquare className="h-3 w-3 text-[#1A6CE4]" aria-hidden="true" /> I agree to the terms</p>
              <div className="mt-1"><Tap><span className={PRIMARY}>Agree and import</span></Tap></div>
            </Mini>
          }
          then={
            <Mini caption="Then">
              <p>The import runs.</p>
              <p className="text-slate-500">Email and phone show on each investor once imported.</p>
            </Mini>
          }
        />
      ),
    },
    {
      title: "Reach out from Manual outreach",
      desc: "Imported investors appear in My contacts and Manual outreach, labeled by source. The directory marks them In outreach so you don't import them twice.",
      screens: (
        <Screens
          tap={
            <Mini caption="In Manual outreach">
              <div className={LINE}><span className="truncate">Keith Freeman</span><span className="rounded bg-violet-50 px-1 text-violet-700">From directory</span></div>
            </Mini>
          }
          then={
            <Mini caption="Back in the directory">
              <div className={LINE}><span className="truncate">8VC</span><span className="rounded bg-emerald-50 px-1 text-emerald-700">In outreach</span></div>
            </Mini>
          }
        />
      ),
    },
  ];
}

export function InvestorDirectoryGuide({ defaultOpen, limits }: Readonly<{ defaultOpen: boolean; limits: GuideLimits }>) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
        How the Investor directory works
      </button>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <HelpCircle className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          How the Investor directory works
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
        {steps(limits).map((s, i) => (
          <li key={s.title} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{s.title}</p>
              <p className="text-xs leading-relaxed text-slate-500">{s.desc}</p>
              {s.screens}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-l-2 border-slate-200 pl-2.5 text-xs text-slate-500">
        Not the iCFO Capital investor network. These are public records with no relationship to iCFO Capital. For warm
        introductions from the network, use Match.
      </p>
    </section>
  );
}
