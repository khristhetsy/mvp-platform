"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useToolkitSave, ToolkitSaveStatus } from "@/hooks/useToolkitSave";

function SaveChip({ status }: { status: ToolkitSaveStatus }) {
  if (status === "idle") return null;
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    saving: { bg: "#F1F5F9", text: "#64748b", label: "Saving…" },
    saved:  { bg: "#F0FDF4", text: "#15803D", label: "Saved" },
    error:  { bg: "#FEF2F2", text: "#DC2626", label: "Save failed" },
  };
  const s = styles[status];
  if (!s) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------

type Difficulty = "easy" | "medium" | "hard";

type PitchQuestion = {
  id: string;
  category: string;
  question: string;
  whyAsked: string;
  framework: string[];
  goodAnswer: string;
  avoid: string[];
  targetLength: string;
  difficulty: Difficulty;
};

const QUESTIONS: PitchQuestion[] = [
  // Traction
  {
    id: "t1", category: "Traction", difficulty: "easy",
    question: "What traction do you have so far?",
    whyAsked: "Investors want proof that real people want what you're building. Traction is the single most de-risking signal available.",
    framework: ["Lead with your strongest metric", "Give a rate of change (e.g. growing X% MoM)", "Back it with a retention or engagement signal", "Close with what this proves about the market"],
    goodAnswer: "We have $48K ARR across 12 paying customers, growing 18% month-over-month for the past 4 months. Net revenue retention is 115%, which tells us customers are expanding, not churning. This validates that the problem is real and recurring.",
    avoid: ["Vanity metrics (downloads, sign-ups) without conversion context", "Burying your best metric in the middle", "Using a single data point without trend context"],
    targetLength: "45–60 seconds",
  },
  {
    id: "t2", category: "Traction", difficulty: "medium",
    question: "How did you acquire your first customers?",
    whyAsked: "First customer acquisition reveals your sales instincts, network, and whether the channel is repeatable.",
    framework: ["Name the specific channel (cold email, network, content)", "Describe what you learned from the first 1–3 deals", "Say whether this channel is repeatable at scale", "Note what you're testing next"],
    goodAnswer: "Our first three customers came from a LinkedIn post I wrote about the problem — we had 400 inbound requests in 24 hours. We converted 3 of the most serious into paid pilots. The signal was that the problem was more acute than we thought. We're now building a structured content engine to replicate that.",
    avoid: ["'We just asked our network' without explaining the scalability implication", "Implying the channel is luck-based", "Not drawing lessons from the acquisition experience"],
    targetLength: "45–60 seconds",
  },
  {
    id: "t3", category: "Traction", difficulty: "hard",
    question: "Your growth slowed last month. What happened?",
    whyAsked: "Investors probe anomalies to test how self-aware founders are and whether they understand their own business deeply.",
    framework: ["Acknowledge the dip directly — don't spin it", "Name the specific cause (seasonality, sales cycle, one-off churn)", "Describe what you've already done to address it", "Forecast when you expect recovery and why"],
    goodAnswer: "January was slower because two enterprise pilots we expected to convert pushed to Q2 — it's a budget approval issue, not a product issue. We've since put milestone-based contracts in place to create urgency. Both are still tracking. February is back on trend.",
    avoid: ["Blaming external factors without owning the response", "Not having a clear explanation ready", "Minimising it without addressing the root cause"],
    targetLength: "60–90 seconds",
  },
  // Market
  {
    id: "m1", category: "Market", difficulty: "easy",
    question: "How big is the market?",
    whyAsked: "Investors need to see that the market is large enough to justify a venture return. $1B+ TAM is typically the minimum for institutional VCs.",
    framework: ["Start with the specific segment you're targeting (SAM)", "Build up to total addressable market (TAM) with a credible source", "Explain your go-to-market logic — how you grow from SAM to TAM", "Anchor with a comparable company as proof of scale"],
    goodAnswer: "Our initial segment — mid-market SaaS companies with 50-500 employees — is a $2.3B addressable market. The broader market for revenue operations tooling is $12B globally, per Gartner 2024. We start with outbound-driven mid-market and expand into enterprise as our product matures — Salesloft followed a similar path to reach $1B ARR.",
    avoid: ["Citing the full global market without your specific segment", "Using unverifiable market size claims", "Top-down only analysis without bottoms-up validation"],
    targetLength: "60 seconds",
  },
  {
    id: "m2", category: "Market", difficulty: "hard",
    question: "Who are your competitors and why will you win?",
    whyAsked: "Investors want to see that you've done rigorous competitive research — and that you can articulate a durable advantage, not just 'we're better'.",
    framework: ["Name 2–3 real competitors directly — don't say 'no one does what we do'", "Acknowledge their strengths (shows intellectual honesty)", "State your specific advantage and why it's defensible", "Describe what makes switching costs high once a customer is in"],
    goodAnswer: "Our main competitors are Gong and Chorus. Gong is excellent for enterprise but costs $20K+ per year and requires a 3-month implementation — neither works for the mid-market. Our advantage is 15-minute setup and transparent per-seat pricing. Once companies integrate our workflow, average session time is 4.2 hours per day — that's a strong retention moat.",
    avoid: ["'We have no direct competitors' — investors won't believe you", "Dismissing competitors without acknowledging what they do well", "Vague differentiation like 'we're easier to use' without specifics"],
    targetLength: "60–75 seconds",
  },
  // Team
  {
    id: "te1", category: "Team", difficulty: "easy",
    question: "Why are you the right team to build this?",
    whyAsked: "At early stage, investors often bet on team over product. They want to see that you have unique insight and relevant experience.",
    framework: ["Lead with the specific experience that creates unfair advantage", "Name the problem you lived or watched someone live", "Reference any previous builds, exits, or domain expertise", "Describe how the co-founders complement each other"],
    goodAnswer: "I spent 6 years as head of compliance at a mid-size bank and watched this problem cause $2M in fines across two institutions. My co-founder built and sold a RegTech company in 2019. Between us we have 5 banking relationships who are already pilot customers. We understand this space at a depth competitors can't replicate quickly.",
    avoid: ["Generic statements like 'we're passionate about this problem'", "Leading with a resume rather than a specific insight", "Not explaining why now is the right moment for this team"],
    targetLength: "45–60 seconds",
  },
  {
    id: "te2", category: "Team", difficulty: "medium",
    question: "What happens if a co-founder leaves?",
    whyAsked: "Co-founder splits are one of the top causes of startup failure. Investors want evidence you've thought about this.",
    framework: ["Reference your vesting schedule (shows you've structured it)", "Describe the complementary nature of roles — one person leaving isn't fatal", "Name the key hires who'd fill critical gaps", "End on a note of alignment — you've had hard conversations already"],
    goodAnswer: "We're both on 4-year vesting with 1-year cliff, so departure early on has limited dilution impact. Critically, I run product and go-to-market, my co-founder runs engineering — we've designed the roles to be independently executable. If either of us left, the company would slow down, not stop. We've also had explicit conversations about this as part of our operating agreement.",
    avoid: ["'We get along great so it won't happen' — not a plan", "Not having a vesting schedule in place", "Being defensive about the hypothetical"],
    targetLength: "45–60 seconds",
  },
  // Financials
  {
    id: "f1", category: "Financials", difficulty: "medium",
    question: "Walk me through your unit economics.",
    whyAsked: "Unit economics reveal whether you can build a profitable business at scale. Investors want to see a path to strong gross margins and manageable payback periods.",
    framework: ["State gross margin first", "CAC and how you calculated it", "LTV and the inputs (ACV × gross margin ÷ churn)", "Payback period (CAC ÷ monthly gross profit)", "How these improve as you scale"],
    goodAnswer: "Gross margins are 72%. CAC is $1,200 including sales salaries and marketing spend divided by new logos last quarter. ACV is $6,000, so LTV is around $14,400 at 72% margin and 30% annual churn. Payback period is just under 3 months. As we move upmarket, CAC stays roughly flat but ACV doubles — so payback drops to 6 weeks at steady state.",
    avoid: ["Confusing revenue and gross profit in LTV calculation", "Excluding salary from CAC", "Not knowing your churn rate"],
    targetLength: "90 seconds",
  },
  {
    id: "f2", category: "Financials", difficulty: "hard",
    question: "What are your assumptions in the financial model?",
    whyAsked: "Investors won't believe your projections — they're stress-testing whether you understand your own business drivers.",
    framework: ["Name your 3 most important assumptions", "Explain the evidence base for each", "Acknowledge which assumption you're least certain about", "Describe what 'good' looks like vs. what 'okay' looks like"],
    goodAnswer: "Three key assumptions: 1) We close 15 new logos per month by month 12 — based on current 3-person team closing 5 each. 2) Average ACV of $8K — based on our last 6 deals. 3) Monthly churn of 2% — we're at 1.8% now, so we've been conservative. The assumption I'm least certain about is expansion revenue, which we've modelled at 10% net expansion. We've only seen it in 2 accounts so far.",
    avoid: ["'Our model is very conservative' — investors hear this every day", "Circular assumptions (you hit your targets because your model says you will)", "Not knowing which assumption is most uncertain"],
    targetLength: "90 seconds",
  },
  // Product
  {
    id: "p1", category: "Product", difficulty: "easy",
    question: "What does your product do?",
    whyAsked: "Can you explain your product in simple terms? Founders often over-complicate this.",
    framework: ["One sentence: [Customer] uses [Product] to [Outcome]", "Describe the before and after state", "Name the primary workflow or interaction", "State the key metric that proves it works"],
    goodAnswer: "Mid-market HR teams use our platform to reduce time-to-hire from 45 days to 12. We automate the first three screening rounds using structured video assessments — hiring managers only review the top 15% of candidates. Companies using us for 6+ months report 40% reduction in cost-per-hire.",
    avoid: ["Technical jargon in the first 20 seconds", "Leading with features instead of outcomes", "Not quantifying the outcome"],
    targetLength: "30–45 seconds",
  },
  {
    id: "p2", category: "Product", difficulty: "medium",
    question: "What's your moat — why can't someone just copy this?",
    whyAsked: "Every successful product will be copied eventually. Investors want to know what makes your advantage compound over time.",
    framework: ["Name the specific moat type (data, network effects, switching costs, brand, proprietary technology)", "Explain why it compounds — it gets stronger the longer you're in the market", "Give a concrete example of the moat in action", "Acknowledge what a well-funded competitor could replicate and what they couldn't"],
    goodAnswer: "Our moat is data network effects. Every assessment completed trains our scoring model for that specific role and industry. After 500 assessments in a category, our quality-of-hire predictions are provably better than a human hiring manager — we have a white paper on this. A competitor starting today would need 18–24 months of assessment data before they could match our model accuracy. That gap compounds as we grow.",
    avoid: ["'First mover advantage' — not a moat", "Moats that rely entirely on the team (people can be poached)", "Not being specific about why time or scale makes it harder to copy"],
    targetLength: "60–75 seconds",
  },
];

const CATEGORIES = [...new Set(QUESTIONS.map((q) => q.category))];

const DIFFICULTY_STYLES: Record<Difficulty, { bg: string; text: string; label: string }> = {
  easy: { bg: "#EAF3DE", text: "#1E6D3C", label: "Warm-up" },
  medium: { bg: "#EEEDFE", text: "#2E78F5", label: "Standard" },
  hard: { bg: "#FCEBEB", text: "#A32D2D", label: "Curveball" },
};

// ---------------------------------------------------------------------------
// Question card
// ---------------------------------------------------------------------------

function QuestionCard({ q }: { q: PitchQuestion }) {
  const t = useTranslations("founderCmp");
  const [answer, setAnswer] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [tab, setTab] = useState<"framework" | "example" | "avoid">("framework");
  const diff = DIFFICULTY_STYLES[q.difficulty];

  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const targetWords = q.targetLength.includes("45") ? 75 : q.targetLength.includes("90") ? 150 : 100;
  const pct = Math.min(100, Math.round((wordCount / targetWords) * 100));
  const score = Math.min(100, pct > 40 ? pct : 0);
  const scoreColor = score >= 80 ? "#16a34a" : score >= 50 ? "#d97706" : "#94a3b8";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="px-4 pt-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ background: "#EEEDFE", color: "#2E78F5" }}>
            {q.category}
          </span>
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ background: diff.bg, color: diff.text }}>
            {diff.label}
          </span>
          <span className="ml-auto text-[10px] text-slate-400">Target: {q.targetLength}</span>
        </div>
        <p className="text-sm font-semibold text-slate-900">&ldquo;{q.question}&rdquo;</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{q.whyAsked}</p>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex border-b border-t border-slate-100">
        {(["framework", "example", "avoid"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-[11px] font-semibold transition"
            style={{
              color: tab === t ? "#2E78F5" : "#94a3b8",
              borderBottom: tab === t ? "2px solid #2E78F5" : "2px solid transparent",
            }}
          >
            {t === "framework" ? "Answer framework" : t === "example" ? "Strong example" : "Avoid"}
          </button>
        ))}
      </div>

      <div className="px-4 py-3">
        {tab === "framework" ? (
          <div className="space-y-1.5">
            {q.framework.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: "#2E78F5" }}>{i + 1}</span>
                <p className="text-xs leading-relaxed text-slate-700">{f}</p>
              </div>
            ))}
          </div>
        ) : tab === "example" ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-100">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">{t("strong_answer")}</p>
            <p className="text-[11px] italic leading-relaxed text-emerald-900">&ldquo;{q.goodAnswer}&rdquo;</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {q.avoid.map((a, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 ring-1 ring-red-100">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <p className="text-[11px] leading-relaxed text-red-800">{a}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Practice area */}
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{t("your_answer")}</p>
          <span className="text-[10px]" style={{ color: scoreColor }}>
            {wordCount} words · {pct}% of target length
          </span>
        </div>
        <textarea
          rows={4}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={t("type_your_answer_here_and_use_the_framework")}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
        />

        {/* Length bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: scoreColor }}
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={wordCount < 10}
            onClick={() => setShowFeedback((o) => !o)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
            style={{ background: "#2E78F5" }}
          >
            {showFeedback ? "Hide feedback" : "Check my answer"}
          </button>
          {answer.length > 0 ? (
            <button type="button" onClick={() => { setAnswer(""); setShowFeedback(false); }} className="text-xs text-slate-400 hover:text-slate-600">
              Clear
            </button>
          ) : null}
        </div>

        {showFeedback && wordCount >= 10 ? (
          <div className="mt-3 space-y-2 rounded-xl border border-indigo-100 bg-[#FAFAFF] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#2E78F5" }}>{t("feedback")}</p>
            {pct < 50 ? (
              <p className="text-xs text-slate-600">Your answer is shorter than ideal. Aim to cover all {q.framework.length} points in the framework — each one adds credibility.</p>
            ) : pct < 80 ? (
              <p className="text-xs text-slate-600">Good start. Make sure you&apos;ve covered every step in the framework, especially the closing signal that demonstrates depth.</p>
            ) : (
              <p className="text-xs text-slate-600">Good length. Compare your answer against the strong example and check: did you lead with the most important metric or fact?</p>
            )}
            <p className="text-xs text-slate-600">
              Compare your answer against the strong example above — focus on how the example leads with specifics and quantifies the outcome.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PitchPracticeSimulator() {
  const t = useTranslations("founderCmp");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | null>(null);

  const { savedData, loaded, save, saveStatus } = useToolkitSave<{ activeCategory: string | null; activeDifficulty: string | null }>("pitch-practice");

  useEffect(() => {
    if (loaded && savedData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveCategory(savedData.activeCategory ?? null);
      setActiveDifficulty((savedData.activeDifficulty as Difficulty | null) ?? null);
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    save({ activeCategory, activeDifficulty });
  }, [activeCategory, activeDifficulty, loaded, save]);

  const filtered = useMemo(() => {
    return QUESTIONS.filter((q) => {
      const matchCat = !activeCategory || q.category === activeCategory;
      const matchDiff = !activeDifficulty || q.difficulty === activeDifficulty;
      return matchCat && matchDiff;
    });
  }, [activeCategory, activeDifficulty]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SaveChip status={saveStatus} />
      </div>

      {/* Intro */}
      <div className="rounded-xl border border-indigo-100 bg-[#FAFAFF] px-4 py-3">
        <p className="text-xs font-semibold" style={{ color: "#2E78F5" }}>{t("how_to_use_this")}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
          Read the framework, then write your answer before revealing the example. Aim to fill the length bar — investors notice when founders run out of things to say. Do hard questions repeatedly until your answer flows without notes.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
            style={{
              background: activeCategory === cat ? "#2E78F5" : "#F1F5F9",
              color: activeCategory === cat ? "white" : "#475569",
            }}
          >
            {cat}
          </button>
        ))}
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
          const s = DIFFICULTY_STYLES[d];
          return (
            <button
              key={d}
              type="button"
              onClick={() => setActiveDifficulty(activeDifficulty === d ? null : d)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
              style={{
                background: activeDifficulty === d ? s.text : s.bg,
                color: activeDifficulty === d ? "white" : s.text,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400">{filtered.length} questions</p>

      <div className="space-y-5">
        {filtered.map((q) => <QuestionCard key={q.id} q={q} />)}
      </div>
    </div>
  );
}
