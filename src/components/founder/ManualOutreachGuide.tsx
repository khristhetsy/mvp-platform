"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mail,
  Sparkles,
  Square,
} from "lucide-react";

/**
 * "How manual outreach works": six steps, each with a mini screen showing where
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
    title: "Launch the wizard",
    desc: "Tap Launch a new wave. The wizard takes you from investors to send in five short steps, and nothing goes out until you start the campaign.",
    screens: (
      <Screens
        tap={
          <Mini caption="Tap">
            <Tap>
              <span className={PRIMARY}>Launch a new wave</span>
            </Tap>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <p className="text-slate-500">Investors, Message, Attachments, Follow ups, Review and send</p>
          </Mini>
        }
      />
    ),
  },
  {
    title: "Choose your investors",
    desc: "Wizard step 1. Search your address book and tick who to contact. You can also add investors from the directory, a file, or by hand. A small, researched first wave works better than a blast.",
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
    title: "Write your message",
    desc: "Wizard step 2. Pick a template or use the AI agent, then edit. One message goes to everyone, and merge fields fill in each investor's details.",
    screens: (
      <Screens
        tap={
          <Mini caption="Tap">
            <Tap>
              <span className="inline-flex items-center gap-1 text-indigo-600">
                <Sparkles className="h-3 w-3" aria-hidden="true" /> AI agent
              </span>
            </Tap>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <div className="mb-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-400">Subject</div>
            <div className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-400">Message</div>
          </Mini>
        }
      />
    ),
  },
  {
    title: "Add attachments and follow ups",
    desc: "Wizard steps 3 and 4. Attachments are optional, and files over 10 MB in total are left off, so a link is often better. Most replies come after a follow up, and each one goes out after the day shown.",
    screens: (
      <Screens
        tap={
          <Mini caption="Set">
            <p>Attachments (optional)</p>
            <p>Follow ups</p>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <p className="text-slate-500">Each follow up goes out after its day</p>
          </Mini>
        }
      />
    ),
  },
  {
    title: "Review and start",
    desc: "Wizard step 5. Check the summary, tick the confirmations, then tap Start campaign. Use Save draft any time to come back later.",
    screens: (
      <Screens
        tap={
          <Mini caption="Tap">
            <Tap>
              <span className={PRIMARY}>
                <Mail className="h-3 w-3" aria-hidden="true" /> Start campaign
              </span>
            </Tap>
          </Mini>
        }
        then={
          <Mini caption="Then">
            <p className="text-emerald-700">Campaign queued</p>
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
