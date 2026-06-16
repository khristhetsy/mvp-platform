"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

type InvestorType = "vc" | "angel" | "family_office" | "corporate";
type TouchNumber = 1 | 2 | 3 | 4;

type SequenceTouch = {
  touch: TouchNumber;
  label: string;
  timing: string;
  subject: (vars: TemplateVars) => string;
  body: (vars: TemplateVars) => string;
  notes: string[];
};

type TemplateVars = {
  investorName: string;
  founderName: string;
  companyName: string;
  industry: string;
  traction: string;
  raiseAmount: string;
  connectionContext: string;
};

const DEFAULT_VARS: TemplateVars = {
  investorName: "Sarah",
  founderName: "Alex",
  companyName: "[Company]",
  industry: "[Industry]",
  traction: "[key traction metric]",
  raiseAmount: "$[X]M",
  connectionContext: "[mutual connection / conference / their portfolio company]",
};

// ---------------------------------------------------------------------------
// Sequence templates per investor type
// ---------------------------------------------------------------------------

const SEQUENCES: Record<InvestorType, SequenceTouch[]> = {
  vc: [
    {
      touch: 1, label: "Cold intro", timing: "Day 1",
      subject: (v) => `${v.companyName} — ${v.industry} / ${v.raiseAmount} seed`,
      body: (v) => `Hi ${v.investorName},

I'm ${v.founderName}, founder of ${v.companyName}. We make it [one sentence on what you do and for whom].

Why I'm reaching out to you specifically: [1–2 sentences referencing their portfolio, thesis, or public writing that makes you genuinely relevant — this line determines whether you get a reply].

Traction: ${v.traction}.

We're raising ${v.raiseAmount}. Deck attached. Happy to hop on a 20-minute intro call if this fits your current focus.

${v.founderName}
${v.companyName}`,
      notes: [
        "Keep to under 100 words in the body — every extra word reduces reply rate",
        "The 'why you specifically' line is the most important sentence in the email",
        "Never say 'I know you're busy' — wastes their time and yours",
        "Attach deck or link to it — don't make them ask",
      ],
    },
    {
      touch: 2, label: "Follow-up 1", timing: "Day 5 (if no reply)",
      subject: (v) => `Re: ${v.companyName} — quick follow-up`,
      body: (v) => `Hi ${v.investorName},

Following up in case this got buried. One data point that might be relevant: [one new metric, customer win, or update since your first email].

Still happy to send more if useful.

${v.founderName}`,
      notes: [
        "Add one new piece of information — don't just resend the same email",
        "Keep this shorter than touch 1: 3–4 sentences max",
        "Subject line 'Re:' keeps the thread — easier for them to find context",
      ],
    },
    {
      touch: 3, label: "Follow-up 2", timing: "Day 12 (if no reply)",
      subject: (v) => `${v.companyName} — one more try`,
      body: (v) => `${v.investorName},

One more reach — if the timing or fit isn't right, totally understand and no hard feelings.

We've since [add another update: new customer, milestone, press mention].

If there's a better person on your team to connect with, I'd appreciate a redirect.

${v.founderName}`,
      notes: [
        "Acknowledge that you've followed up twice — shows self-awareness",
        "Asking for a redirect is a face-saving exit for them that still helps you",
        "Don't apologise for following up — you're running a professional process",
      ],
    },
    {
      touch: 4, label: "Breakup email", timing: "Day 21 (close the loop)",
      subject: (v) => `Closing the loop — ${v.companyName}`,
      body: (v) => `${v.investorName},

I'll stop reaching out after this one. If ${v.companyName} is ever relevant for a future fund or you hear of someone who'd be interested, I'd love an introduction.

We'll be closing our ${v.raiseAmount} round in [X weeks]. Happy to revisit if timing changes.

Thanks for your time either way.

${v.founderName}`,
      notes: [
        "Breakup emails often get replies — the 'last one' creates urgency",
        "Set a real deadline if you have one — vagueness reduces urgency",
        "Keep your tone warm: you may cross paths with this investor again",
      ],
    },
  ],

  angel: [
    {
      touch: 1, label: "Warm intro or cold reach", timing: "Day 1",
      subject: (v) => `${v.companyName} — angel round intro`,
      body: (v) => `Hi ${v.investorName},

${v.connectionContext ? `[${v.connectionContext}] suggested I reach out.` : "I came across your angel investing work and wanted to introduce myself."}

I'm ${v.founderName}, building ${v.companyName} — [one sentence on what it does].

${v.traction ? `We have ${v.traction}.` : ""}

We're raising ${v.raiseAmount} from angels who understand [specific niche/domain]. Given your background in [their relevant experience], I thought you'd have useful perspective even if the cheque size isn't right.

Would a 20-minute call work?

${v.founderName}`,
      notes: [
        "Angels invest more personally — mention the connection context upfront",
        "Flattering their expertise (authentically) works better than just citing traction",
        "Ask for a call, not a Zoom — angels move faster on informal conversations",
        "Smaller cheque = shorter decision cycle: follow up sooner than with VCs",
      ],
    },
    {
      touch: 2, label: "Follow-up 1", timing: "Day 4",
      subject: (v) => `Re: ${v.companyName} — quick update`,
      body: (v) => `Hi ${v.investorName},

Bumping this in case it got lost. Quick update: [new metric or news].

[Mutual contact] mentioned you tend to move fast when something clicks — happy to send more detail or get on a call this week.

${v.founderName}`,
      notes: [
        "Angels have shorter attention windows — follow up faster than with VCs",
        "Name-dropping the mutual contact (if there is one) keeps the social proof alive",
      ],
    },
    {
      touch: 3, label: "Follow-up 2 + social proof", timing: "Day 10",
      subject: (v) => `${v.companyName} — who else is in`,
      body: (v) => `${v.investorName},

We're now [X]% committed on this round, with [notable angel or known name] leading. Wanted to flag in case the momentum is useful context.

Still a few spots at the target cheque size. Happy to connect this week.

${v.founderName}`,
      notes: [
        "Round momentum is a powerful signal for angels — they follow social proof",
        "Don't fabricate this: only send if you genuinely have commitments",
      ],
    },
    {
      touch: 4, label: "Breakup", timing: "Day 18",
      subject: (v) => `Closing the loop — ${v.companyName}`,
      body: (v) => `${v.investorName},

Last one — we're closing the round in [X days]. If the timing's off, no worries at all.

If you'd ever want to stay connected to what we're building, I'm happy to add you to our investor update list either way.

${v.founderName}`,
      notes: [
        "Offering the update list keeps the relationship alive even if they don't invest",
      ],
    },
  ],

  family_office: [
    {
      touch: 1, label: "Formal intro", timing: "Day 1",
      subject: (v) => `Introduction — ${v.companyName} (${v.industry})`,
      body: (v) => `Dear ${v.investorName},

I am writing to introduce ${v.companyName}, a [industry] company currently raising ${v.raiseAmount} in [round type].

${v.connectionContext ? `[${v.connectionContext}] suggested your family office might have interest given your focus on [relevant sector or geography].` : "We identified your family office as a potential strategic partner given your focus on [relevant sector or geography]."}

${v.traction ? `Brief background: ${v.traction}.` : ""}

I have attached our investment summary and would welcome the opportunity to present in more detail at your convenience.

Regards,
${v.founderName}
${v.companyName}`,
      notes: [
        "Family offices expect formal tone — match their communication style",
        "Lead with the personal or institutional connection if one exists",
        "Include a one-page investment summary, not just a deck link",
        "Expect longer decision cycles: 30–90 days is normal",
      ],
    },
    {
      touch: 2, label: "Follow-up", timing: "Day 10",
      subject: (v) => `Following up — ${v.companyName} investment summary`,
      body: (v) => `Dear ${v.investorName},

I wanted to follow up on my previous note regarding ${v.companyName}.

[Add any relevant update: new partnerships, customer wins, or progress toward close.]

I understand decisions of this nature require careful consideration and I am happy to provide any additional information — financials, references, or a call with our advisors.

Thank you for your time.

${v.founderName}`,
      notes: [
        "Family offices move deliberately — a 10-day follow-up is appropriate",
        "Offering references or advisors signals institutional seriousness",
      ],
    },
    {
      touch: 3, label: "Final follow-up", timing: "Day 25",
      subject: (v) => `${v.companyName} — round closing timeline`,
      body: (v) => `Dear ${v.investorName},

As we approach our closing date of [date], I wanted to reach out one final time.

We would be pleased to welcome [Family Office name] as a partner in ${v.companyName} and remain available to answer any remaining questions.

If this is not the right fit at this time, we would appreciate any referrals to others in your network who might have interest.

With appreciation,
${v.founderName}`,
      notes: [
        "Family offices appreciate formal closure — don't just stop emailing",
        "Asking for referrals is appropriate at this stage",
      ],
    },
    {
      touch: 4, label: "Post-close update", timing: "30 days post-close",
      subject: (v) => `${v.companyName} — round closed, keeping you updated`,
      body: (v) => `Dear ${v.investorName},

I wanted to let you know that we successfully closed our ${v.raiseAmount} round last month. Thank you for considering the opportunity.

We will be raising again in [timeframe]. I will be in touch as that approaches and would welcome the chance to reconnect.

In the meantime, I hope to cross paths at [relevant conference or event].

${v.founderName}`,
      notes: [
        "Staying in touch post-close keeps the door open for future rounds",
        "Family offices think in decades — maintaining the relationship matters",
      ],
    },
  ],

  corporate: [
    {
      touch: 1, label: "Strategic intro", timing: "Day 1",
      subject: (v) => `Strategic investment opportunity — ${v.companyName}`,
      body: (v) => `Hi ${v.investorName},

I'm ${v.founderName}, founder of ${v.companyName}. We [one sentence on what you do].

I'm reaching out because we see [Corporate's name] as a potential strategic partner — specifically, [one concrete reason how your company adds value to their business or technology roadmap].

${v.traction ? `We currently have ${v.traction}.` : ""}

We're raising ${v.raiseAmount} and looking for one or two strategic investors alongside our lead. Is there a right person on your venture or strategic investment team to connect with?

${v.founderName}
${v.companyName}`,
      notes: [
        "Corporate VCs invest for strategic reasons, not just financial returns",
        "Lead with the strategic fit — how does this help their business?",
        "Ask to be routed to the right team — corporate hierarchies are complex",
        "Decision cycles can be 3–6 months: start early and track timing carefully",
      ],
    },
    {
      touch: 2, label: "Follow-up", timing: "Day 7",
      subject: (v) => `Re: ${v.companyName} — strategic fit note`,
      body: (v) => `Hi ${v.investorName},

Following up on my note last week. I put together a short summary of the strategic fit between ${v.companyName} and [their company] — happy to send it over if useful.

Also happy to connect with your BD or product team if that's a more natural entry point.

${v.founderName}`,
      notes: [
        "Offering a strategic fit memo shows preparation and seriousness",
        "Suggesting a BD/product introduction gives them an internal routing option",
      ],
    },
    {
      touch: 3, label: "Follow-up with proof point", timing: "Day 16",
      subject: (v) => `${v.companyName} — new customer in your space`,
      body: (v) => `${v.investorName},

Quick update: we just signed [relevant customer or partner — ideally one they'd recognise]. Happy to share more on how we're approaching the [relevant market].

We're closing this round in [X weeks] — if timing works, I'd love 20 minutes.

${v.founderName}`,
      notes: [
        "For corporate VCs, customer logos in their competitive landscape are highly relevant",
      ],
    },
    {
      touch: 4, label: "Breakup", timing: "Day 28",
      subject: (v) => `Closing the loop — ${v.companyName}`,
      body: (v) => `${v.investorName},

I'll leave it here. If the strategic fit isn't right for [their company] at this stage, no worries at all.

We'll be in market again in [timeframe] and I'll be sure to reconnect then. In the meantime, happy to stay in touch.

${v.founderName}`,
      notes: [],
    },
  ],
};

const INVESTOR_TYPE_LABELS: Record<InvestorType, string> = {
  vc: "VC / Institutional",
  angel: "Angel investor",
  family_office: "Family office",
  corporate: "Corporate VC",
};

// ---------------------------------------------------------------------------
// Touch card
// ---------------------------------------------------------------------------

function TouchCard({
  touch, vars, investorType,
}: {
  touch: SequenceTouch;
  vars: TemplateVars;
  investorType: InvestorType;
}) {
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  const subject = touch.subject(vars);
  const body = touch.body(vars);

  function copy(text: string, key: "subject" | "body") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const touchColors = ["#534AB7", "#059669", "#d97706", "#dc2626"];
  const color = touchColors[(touch.touch - 1) % touchColors.length];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: `${color}10` }}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
          {touch.touch}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{touch.label}</p>
          <p className="text-[10px] text-slate-500">{touch.timing}</p>
        </div>
      </div>

      {/* Subject */}
      <div className="border-b border-slate-100 px-4 py-2.5">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Subject line</p>
          <button
            type="button"
            onClick={() => copy(subject, "subject")}
            className="text-[10px] font-medium transition"
            style={{ color: copied === "subject" ? "#059669" : "#534AB7" }}
          >
            {copied === "subject" ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-sm text-slate-800">{subject}</p>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Email body</p>
          <button
            type="button"
            onClick={() => copy(body, "body")}
            className="text-[10px] font-medium transition"
            style={{ color: copied === "body" ? "#059669" : "#534AB7" }}
          >
            {copied === "body" ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-700">
          {body}
        </pre>
      </div>

      {/* Notes */}
      {touch.notes.length > 0 ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Tips for this touch</p>
          <div className="space-y-1">
            {touch.notes.map((n, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-[10px]" style={{ color }}>•</span>
                <p className="text-[11px] leading-relaxed text-slate-600">{n}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EmailSequenceBuilder() {
  const [investorType, setInvestorType] = useState<InvestorType>("vc");
  const [vars, setVars] = useState<TemplateVars>(DEFAULT_VARS);
  const [showCustomise, setShowCustomise] = useState(false);

  const sequence = SEQUENCES[investorType];

  function update(key: keyof TemplateVars, value: string) {
    setVars((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-xl border border-indigo-100 bg-[#FAFAFF] px-4 py-3">
        <p className="text-xs font-semibold" style={{ color: "#534AB7" }}>How to use this</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
          Select investor type, fill in your variables, then copy each email. Personalise the text in [brackets] before sending — the more specific those lines, the higher your reply rate.
        </p>
      </div>

      {/* Investor type selector */}
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700">Investor type</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SEQUENCES) as InvestorType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setInvestorType(t)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              style={{
                background: investorType === t ? "#534AB7" : "#F1F5F9",
                color: investorType === t ? "white" : "#475569",
              }}
            >
              {INVESTOR_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Variable customiser */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowCustomise((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <p className="text-sm font-semibold text-slate-800">Personalise your templates</p>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            className="transition-transform"
            style={{ transform: showCustomise ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showCustomise ? (
          <div className="border-t border-slate-100 px-4 py-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(vars) as (keyof TemplateVars)[]).map((key) => (
              <div key={key}>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                </label>
                <input
                  type="text"
                  value={vars[key]}
                  onChange={(e) => update(key, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Sequence timing overview */}
      <div className="flex items-start gap-0">
        {sequence.map((t, i) => (
          <div key={t.touch} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className="flex-1" style={{ height: 2, background: i === 0 ? "transparent" : "#E2E8F0" }} />
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "#534AB7" }}>
                {t.touch}
              </div>
              <div className="flex-1" style={{ height: 2, background: i === sequence.length - 1 ? "transparent" : "#E2E8F0" }} />
            </div>
            <p className="mt-1 text-center text-[9px] font-semibold text-slate-400">{t.timing}</p>
          </div>
        ))}
      </div>

      {/* Touch cards */}
      <div className="space-y-4">
        {sequence.map((t) => (
          <TouchCard key={t.touch} touch={t} vars={vars} investorType={investorType} />
        ))}
      </div>

      {/* General tips */}
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">Sequence best practices</p>
        <div className="space-y-1">
          {[
            "Run 4 touches max — more than that hurts your reputation",
            "Never send touch 2+ on a weekend or Monday morning",
            "Track open rates if using a tool like Superhuman — a high open rate with no reply means your subject line is working but the body isn't",
            "If you get a reply that says 'not now', set a reminder to follow up in 3 months — timing is often the only objection",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px] text-amber-600">•</span>
              <p className="text-[11px] leading-relaxed text-amber-800">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
