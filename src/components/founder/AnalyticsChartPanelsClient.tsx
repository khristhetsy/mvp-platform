"use client";

import { useState, useEffect } from "react";
import type { FounderAnalyticsSnapshot } from "@/lib/analytics/founder-analytics";

type DrawerKey = "outreach" | "social" | "investors" | "readiness";

// ---------------------------------------------------------------------------
// Drawer primitives
// ---------------------------------------------------------------------------
function DStatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

type BVariant = "success" | "medium" | "high" | "neutral" | "critical";
const BCLS: Record<BVariant, string> = {
  success: "bg-[#EAF3DE] text-[#1E6D3C]",
  medium: "bg-[#EEEDFE] text-[#3C3489]",
  high: "bg-[#FAEEDA] text-[#854F0B]",
  neutral: "bg-slate-100 text-slate-600",
  critical: "bg-[#FCEBEB] text-[#A32D2D]",
};

function BRow({ name, badge, variant = "neutral" }: { name: string; badge: string; variant?: BVariant }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-xs last:border-0">
      <span className="min-w-0 flex-1 truncate text-slate-800">{name}</span>
      <span className={`ml-3 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${BCLS[variant]}`}>
        {badge}
      </span>
    </div>
  );
}

function AdviceBox({ lines }: { lines: string[] }) {
  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: "#1e1b4b" }}>
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "#534AB7" }}
        >
          AI
        </div>
        <span className="text-sm font-medium" style={{ color: "#e0e7ff" }}>
          Founder Intelligence
        </span>
      </div>
      <div className="space-y-2.5">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 text-xs leading-relaxed">
            <span className="shrink-0 font-semibold" style={{ color: "#818cf8" }}>{i + 1}.</span>
            <span style={{ color: "#c7d2fe" }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer content
// ---------------------------------------------------------------------------
function DrawerContent({
  drawerKey,
  analytics,
  onClose,
}: {
  drawerKey: DrawerKey;
  analytics: FounderAnalyticsSnapshot;
  onClose: () => void;
}) {
  const closeBtn = (
    <button
      type="button"
      onClick={onClose}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
      aria-label="Close"
    >
      ✕
    </button>
  );

  // ── Outreach pipeline ─────────────────────────────────────────────────────
  if (drawerKey === "outreach") {
    const entries = Object.entries(analytics.outreachByStatus);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    const maxVal = Math.max(...entries.map(([, v]) => v), 1);
    const topEntry = entries.sort((a, b) => b[1] - a[1])[0];

    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Outreach pipeline</p>
            <p className="mt-0.5 text-xs text-slate-500">Investor outreach by current status</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Total targets" value={String(total)} />
          <DStatBox label="Statuses" value={String(entries.length)} />
          <DStatBox label="Top status" value={topEntry ? topEntry[0].replace(/_/g, " ") : "—"} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">Status breakdown</p>
        <div className="mt-2">
          {entries.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No outreach data yet.</p>
          ) : (
            entries
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <BRow
                  key={status}
                  name={status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  badge={String(count)}
                  variant={
                    status === "converted" || status === "closed"
                      ? "success"
                      : status === "meeting" || status === "engaged"
                      ? "medium"
                      : status === "no_reply" || status === "bounced"
                      ? "critical"
                      : "neutral"
                  }
                />
              ))
          )}
        </div>

        {total > 0 && (
          <div className="mt-4 space-y-2">
            {entries
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([status, count]) => (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] capitalize text-slate-600">{status.replace(/_/g, " ")}</span>
                    <span className="text-[11px] font-semibold text-slate-800">{count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${(count / maxVal) * 100}%`, background: "#534AB7" }} />
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {total === 0
              ? "No outreach recorded yet. Start logging your investor conversations in the pipeline to track conversion rates and identify where prospects stall."
              : `Your outreach pipeline has ${total} investor target${total === 1 ? "" : "s"} across ${entries.length} status${entries.length === 1 ? "" : "es"}. ${topEntry ? `The largest group (${topEntry[1]}) is at "${topEntry[0].replace(/_/g, " ")}" — this is where most of your energy should be focused.` : ""}`}
          </p>
        </div>

        <AdviceBox
          lines={[
            total === 0
              ? "Start by logging your 10 warmest investor contacts. Even if conversations haven't started, having them in your pipeline makes it easy to track next actions and follow-up dates."
              : `You have ${total} targets in your pipeline. The key metric to optimise is conversion rate between stages — identify which status transitions have the lowest rates and focus your energy there.`,
            topEntry && topEntry[1] > 3
              ? `${topEntry[1]} investors are at "${topEntry[0].replace(/_/g, " ")}" — your largest cohort. Schedule a dedicated outreach sprint this week to move as many as possible to the next stage.`
              : total > 0
              ? "Your pipeline is relatively concentrated. Diversify by adding 10–15 new cold contacts each week — at typical conversion rates, you need 50–100 outreaches to find 3–5 serious investors."
              : "Build your pipeline with a mix of warm introductions (via existing investors or advisors) and cold outreach. Warm intros convert at 4–6× the rate of cold email.",
            total > 0
              ? "Review every stalled conversation (no reply for 7+ days) and send a brief, value-add follow-up: share a recent metric, a press mention, or a relevant market insight. This restarts more than 30% of stalled threads."
              : "Set a goal of reaching out to 5 new investors per week. Consistency matters more than volume — 5 well-researched outreaches convert better than 50 generic cold emails.",
          ]}
        />
      </div>
    );
  }

  // ── Social drafts ─────────────────────────────────────────────────────────
  if (drawerKey === "social") {
    const copyRate =
      analytics.socialDraftGenerated > 0
        ? Math.round((analytics.socialDraftCopied / analytics.socialDraftGenerated) * 100)
        : 0;
    const flagRate =
      analytics.socialDraftGenerated > 0
        ? Math.round((analytics.socialDraftFlagged / analytics.socialDraftGenerated) * 100)
        : 0;

    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Social drafts</p>
            <p className="mt-0.5 text-xs text-slate-500">AI-generated content produced in iCapOS</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Generated" value={String(analytics.socialDraftGenerated)} />
          <DStatBox label="Copied" value={String(analytics.socialDraftCopied)} />
          <DStatBox label="Copy rate" value={analytics.socialDraftGenerated > 0 ? `${copyRate}%` : "—"} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">Content breakdown</p>
        <div className="mt-2">
          <BRow
            name="Total drafts generated"
            badge={String(analytics.socialDraftGenerated)}
            variant={analytics.socialDraftGenerated > 0 ? "medium" : "neutral"}
          />
          <BRow
            name="Drafts copied for use"
            badge={String(analytics.socialDraftCopied)}
            variant={analytics.socialDraftCopied > 0 ? "success" : "neutral"}
          />
          <BRow
            name="Copy rate"
            badge={analytics.socialDraftGenerated > 0 ? `${copyRate}%` : "—"}
            variant={copyRate >= 60 ? "success" : copyRate >= 30 ? "medium" : "neutral"}
          />
          <BRow
            name="Flagged for compliance"
            badge={String(analytics.socialDraftFlagged)}
            variant={analytics.socialDraftFlagged > 0 ? "high" : "neutral"}
          />
          <BRow
            name="Compliance flag rate"
            badge={analytics.socialDraftGenerated > 0 ? `${flagRate}%` : "—"}
            variant={flagRate > 20 ? "critical" : flagRate > 5 ? "high" : analytics.socialDraftGenerated > 0 ? "success" : "neutral"}
          />
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {analytics.socialDraftGenerated === 0
              ? "No social drafts generated yet. Use the AI content tools to create LinkedIn posts, investor update emails, and pitch narrative drafts — consistent founder content builds trust with investors before your first meeting."
              : `You've generated ${analytics.socialDraftGenerated} draft${analytics.socialDraftGenerated === 1 ? "" : "s"}, with ${analytics.socialDraftCopied} used (${copyRate}% copy rate). ${analytics.socialDraftFlagged > 0 ? `${analytics.socialDraftFlagged} flagged for compliance review — ensure all content meets securities law requirements before publishing.` : "No compliance flags — your content is staying within acceptable boundaries."}`}
          </p>
        </div>

        <AdviceBox
          lines={[
            analytics.socialDraftGenerated === 0
              ? "Start with a founder update post — share one milestone from the last 30 days. Investor-facing content that's factual and forward-looking builds your personal brand and keeps warm contacts engaged."
              : copyRate < 40
              ? `Your copy rate of ${copyRate}% suggests the generated content isn't quite matching your voice. Try providing more context in your prompts — include your specific metrics, target investor type, and preferred tone.`
              : `A ${copyRate}% copy rate is strong. Keep generating and refining — founders who post consistently (2–3× per week) report significantly higher inbound investor interest within 60–90 days.`,
            analytics.socialDraftFlagged > 0
              ? `${analytics.socialDraftFlagged} draft${analytics.socialDraftFlagged === 1 ? " was" : "s were"} flagged for compliance. Review each before posting — avoid forward-looking statements about returns, specific investment terms, or anything that could be construed as a securities solicitation without proper legal framing.`
              : analytics.socialDraftCopied > 0
              ? "No compliance flags on your used drafts. Keep framing posts around milestones, team, and vision rather than financial projections — this keeps content shareable without triggering disclosure requirements."
              : "When posting about your raise, consult your attorney about whether you're conducting a general solicitation under Rule 506(c) — this affects who you can openly promote your raise to.",
            analytics.socialDraftCopied > 0
              ? "Track which content types get the most engagement (likes, comments, DMs). High-engagement formats should be repeated — most founders find that behind-the-scenes content and specific metrics outperform generic thought leadership."
              : "Your best first post is a brief company origin story: why you started it, the problem you saw, and one concrete metric from early traction. This format gets high engagement and positions you as a credible founder.",
          ]}
        />
      </div>
    );
  }

  // ── Platform investor activity ────────────────────────────────────────────
  if (drawerKey === "investors") {
    const totalActivity = analytics.investorInterestCount + analytics.introRequestCount + analytics.savedByInvestorsCount;

    return (
      <div className="px-5 pb-6 pt-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Platform investor activity</p>
            <p className="mt-0.5 text-xs text-slate-500">Inbound signals from registered investors</p>
          </div>
          {closeBtn}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DStatBox label="Total signals" value={String(totalActivity)} />
          <DStatBox label="Interested" value={String(analytics.investorInterestCount)} />
          <DStatBox label="Intros" value={String(analytics.introRequestCount)} />
        </div>

        <p className="mt-5 text-xs font-semibold text-slate-900">Activity breakdown</p>
        <div className="mt-2">
          <BRow
            name="Expressed interest"
            badge={String(analytics.investorInterestCount)}
            variant={analytics.investorInterestCount > 0 ? "medium" : "neutral"}
          />
          <BRow
            name="Intro requests"
            badge={String(analytics.introRequestCount)}
            variant={analytics.introRequestCount > 0 ? "high" : "neutral"}
          />
          <BRow
            name="Saved your deal"
            badge={String(analytics.savedByInvestorsCount)}
            variant={analytics.savedByInvestorsCount > 0 ? "medium" : "neutral"}
          />
          <BRow
            name="Total unique interactions"
            badge={String(totalActivity)}
            variant={totalActivity > 0 ? "success" : "neutral"}
          />
        </div>

        {totalActivity > 0 && (
          <div className="mt-4 space-y-2">
            {[
              { label: "Expressed interest", value: analytics.investorInterestCount, color: "#534AB7" },
              { label: "Intro requests", value: analytics.introRequestCount, color: "#854F0B" },
              { label: "Saved deals", value: analytics.savedByInvestorsCount, color: "#0369a1" },
            ].map((row) => {
              const pct = totalActivity > 0 ? Math.round((row.value / totalActivity) * 100) : 0;
              return (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] text-slate-600">{row.label}</span>
                    <span className="text-[11px] font-semibold text-slate-800">{row.value}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: row.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
          <p className="text-xs leading-relaxed text-slate-600">
            {totalActivity === 0
              ? "No inbound investor activity yet. Make sure your listing is published with a complete data room — investors on the platform discover companies through marketplace search and curated match recommendations."
              : `${totalActivity} inbound signal${totalActivity === 1 ? "" : "s"} from platform investors. ${analytics.introRequestCount > 0 ? `${analytics.introRequestCount} intro request${analytics.introRequestCount === 1 ? " is" : "s are"} the highest-priority — these investors are actively trying to connect.` : analytics.investorInterestCount > 0 ? `${analytics.investorInterestCount} investor${analytics.investorInterestCount === 1 ? " has" : "s have"} expressed formal interest in your raise.` : `${analytics.savedByInvestorsCount} investor${analytics.savedByInvestorsCount === 1 ? " has" : "s have"} saved your deal — they're tracking it without committing yet.`}`}
          </p>
        </div>

        <AdviceBox
          lines={[
            analytics.introRequestCount > 0
              ? `You have ${analytics.introRequestCount} unanswered intro request${analytics.introRequestCount === 1 ? "" : "s"} — these are your hottest leads right now. Respond within 24 hours: a brief, warm reply with your calendar link converts at a much higher rate than a delayed or generic response.`
              : analytics.investorInterestCount > 0
              ? `${analytics.investorInterestCount} investor${analytics.investorInterestCount === 1 ? " has" : "s have"} expressed formal interest. Send each a personalised message (referencing why you think there's a fit) with a short data-room link — don't wait for them to reach out again.`
              : analytics.savedByInvestorsCount > 0
              ? `${analytics.savedByInvestorsCount} investor${analytics.savedByInvestorsCount === 1 ? " is" : "s are"} watching your deal. A company update (milestone achieved, metric improvement) often converts passive watchers into active interest — post one this week.`
              : "Getting your first inbound signal requires a complete, compelling listing. Prioritise: (1) published listing, (2) pitch deck uploaded, (3) funding target set. These three together drive 80% of initial investor discovery.",
            totalActivity > 0
              ? "Log every investor conversation in your pipeline immediately after it happens — response time, their specific objections, and agreed next steps. Investors who feel you're organised and responsive are significantly more likely to advance."
              : "Consider whether your listing is optimised for discovery. Investors filter by sector, stage, and check size — ensure your company profile accurately reflects all three so you appear in relevant searches.",
            totalActivity > 5
              ? `With ${totalActivity} interactions, you have enough data to identify patterns. Which investors converted from interest to intro? Replicate that outreach pathway for new prospects.`
              : "Supplement inbound activity with outbound outreach to your matched investor list. Platform investors who receive both a platform signal and a personalised direct message convert at 3× the rate.",
          ]}
        />
      </div>
    );
  }

  // ── Readiness score history ───────────────────────────────────────────────
  const snapshots = analytics.readinessSnapshots;
  const latestScore = snapshots.length > 0 ? (snapshots[snapshots.length - 1]?.score ?? null) : null;
  const prevScore = snapshots.length > 1 ? (snapshots[snapshots.length - 2]?.score ?? null) : null;
  const trend = latestScore !== null && prevScore !== null ? latestScore - prevScore : null;

  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">Readiness score history</p>
          <p className="mt-0.5 text-xs text-slate-500">Diligence report snapshots over time</p>
        </div>
        {closeBtn}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DStatBox label="Latest score" value={latestScore !== null ? `${latestScore}` : "—"} />
        <DStatBox label="Trend" value={trend !== null ? (trend > 0 ? `+${trend}` : String(trend)) : "—"} />
        <DStatBox label="Snapshots" value={String(snapshots.length)} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">Score history</p>
      <div className="mt-2">
        {snapshots.length === 0 ? (
          <p className="py-2 text-xs text-slate-400">No diligence reports yet.</p>
        ) : (
          [...snapshots]
            .reverse()
            .slice(0, 6)
            .map((row) => (
              <BRow
                key={row.createdAt}
                name={new Date(row.createdAt).toLocaleDateString("en-US", {
                  timeZone: "UTC",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                badge={row.score !== null ? `${row.score} / 100` : "—"}
                variant={
                  row.score === null ? "neutral"
                  : row.score >= 80 ? "success"
                  : row.score >= 50 ? "medium"
                  : "high"
                }
              />
            ))
        )}
      </div>

      {snapshots.length > 0 && latestScore !== null && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Current readiness</span>
            <span className="font-semibold" style={{ color: latestScore >= 80 ? "#3B6D11" : latestScore >= 50 ? "#534AB7" : "#854F0B" }}>
              {latestScore}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${latestScore}%`,
                background: latestScore >= 80 ? "#3B6D11" : latestScore >= 50 ? "#534AB7" : "#854F0B",
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
        <p className="text-xs leading-relaxed text-slate-600">
          {snapshots.length === 0
            ? "No diligence reports generated yet. Run a readiness assessment from the Readiness section to get your baseline score — this is the first thing investors ask for when evaluating a company."
            : latestScore === null
            ? "Your latest report has no score yet. Complete all sections of the diligence questionnaire to generate a score."
            : trend !== null && trend > 0
            ? `Your readiness score has improved by ${trend} point${trend === 1 ? "" : "s"} since your last report — positive momentum. ${latestScore >= 80 ? "At 80+, you're in investor-ready territory." : `Continue addressing gaps to reach the 80+ threshold investors expect from raise-ready companies.`}`
            : trend !== null && trend < 0
            ? `Your score dropped ${Math.abs(trend)} point${Math.abs(trend) === 1 ? "" : "s"} since the last report. Review what changed — gaps in documentation, missing data room items, or compliance issues can cause score drops.`
            : `Your readiness score is ${latestScore}/100. ${latestScore >= 80 ? "Excellent — you're presenting a well-prepared, investor-ready profile." : latestScore >= 50 ? "Good foundation, but there are specific gaps to address before you'll be considered fully investor-ready." : "Significant preparation required. Focus on the critical missing items in your readiness report before engaging investors seriously."}`}
        </p>
      </div>

      <AdviceBox
        lines={[
          snapshots.length === 0
            ? "Run your first readiness assessment today. It takes 10–15 minutes and gives you a prioritised list of what to fix — investors who review your diligence report before a meeting convert at much higher rates."
            : latestScore !== null && latestScore < 50
            ? `At ${latestScore}/100, focus on the critical items first: incorporate your entity, complete your cap table, and upload a current pitch deck. These three items alone can move your score by 20–30 points.`
            : latestScore !== null && latestScore < 80
            ? `At ${latestScore}/100, you're in the mid-range. Typical gaps at this stage are: missing financial model, incomplete data room, no written investor update template, and no formal advisory board. Fixing two of these can push you past 80.`
            : `Your score of ${latestScore}/100 puts you in the investor-ready range. Use this as a credibility signal in conversations — a high diligence score reduces perceived risk and often leads to faster term sheet decisions.`,
          snapshots.length > 1 && trend !== null
            ? trend > 0
              ? `Your ${trend}-point improvement is meaningful. At this rate, share your progress with prospective investors — showing that you're actively improving your readiness signals coachability and execution discipline.`
              : trend < 0
              ? `Investigate the ${Math.abs(trend)}-point drop before your next investor conversation. Declining readiness scores signal operational gaps — address them before they come up in due diligence.`
              : "Your score is stable — no regression, but also no improvement. Pick one specific item from your report this week and fully resolve it to restart upward momentum."
            : "Run a new readiness report every 4–6 weeks. Frequent re-assessment keeps your data room current and gives you concrete evidence of progress to share with investors.",
          latestScore !== null && latestScore >= 70
            ? "With a strong readiness score, you're ready to approach institutional investors. Consider requesting a warm introduction through your existing network or advisor board — a good readiness score dramatically increases your close rate on warm intros."
            : snapshots.length > 0
            ? "Your readiness score directly affects how investors perceive your risk profile. Every point above 75 reduces friction in the due diligence process — investors who see organised, complete documentation move faster to term sheet."
            : "Investors use readiness scores as a first filter. A score below 60 often results in a 'come back when you're more ready' response. Getting to 70+ before approaching most institutional investors is the recommended baseline.",
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel card button — matches existing chart panel styling
// ---------------------------------------------------------------------------
function PanelCard({
  title,
  subtitle,
  children,
  onClick,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-indigo-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.99]"
      style={{ boxShadow: "0 1px 3px rgb(12 35 64 / 0.05)" }}
    >
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="text-[10px] font-semibold text-indigo-400 opacity-0 transition group-hover:opacity-100">
          View details →
        </span>
      </div>
      <div className="p-5">{children}</div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function AnalyticsChartPanelsClient({ analytics }: { analytics: FounderAnalyticsSnapshot }) {
  const [open, setOpen] = useState<DrawerKey | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const outreachEntries = Object.entries(analytics.outreachByStatus);
  const outreachTotal = outreachEntries.reduce((s, [, v]) => s + v, 0);
  const outreachMax = Math.max(...outreachEntries.map(([, v]) => v), 1);

  const socialRows = [
    { label: "Total drafts", value: analytics.socialDraftGenerated, color: "#534AB7" },
    { label: "Copied", value: analytics.socialDraftCopied, color: "#3B6D11" },
    { label: "Flagged compliance", value: analytics.socialDraftFlagged, color: "#A32D2D" },
  ];
  const socialMax = Math.max(...socialRows.map((r) => r.value), 1);

  const activityRows = [
    { label: "Expressed interest", value: analytics.investorInterestCount, color: "#534AB7" },
    { label: "Intro requests", value: analytics.introRequestCount, color: "#3B6D11" },
    { label: "Saved deals", value: analytics.savedByInvestorsCount, color: "#0369a1" },
  ];
  const activityMax = Math.max(...activityRows.map((r) => r.value), 1);

  return (
    <>
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        {/* Outreach pipeline */}
        <PanelCard title="Outreach pipeline" subtitle="By status · current snapshot" onClick={() => setOpen("outreach")}>
          {outreachEntries.length === 0 ? (
            <p className="text-sm text-slate-400">No outreach data yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs text-slate-500">Total targets</span>
                <span className="text-sm font-bold text-slate-900">{outreachTotal}</span>
              </div>
              {outreachEntries.map(([status, count]) => (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs capitalize text-slate-600">{status.replace(/_/g, " ")}</span>
                    <span className="text-xs font-semibold text-slate-800">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${(count / outreachMax) * 100}%`, background: "#534AB7" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        {/* Social drafts */}
        <PanelCard title="Social drafts" subtitle="Generated in iCapOS" onClick={() => setOpen("social")}>
          <div className="space-y-3">
            {socialRows.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <span className="text-xs font-semibold text-slate-800">{row.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(row.value / socialMax) * 100}%`, background: row.color }} />
                </div>
              </div>
            ))}
          </div>
        </PanelCard>

        {/* Platform investor activity */}
        <PanelCard title="Platform investor activity" subtitle="Inbound from registered investors" onClick={() => setOpen("investors")}>
          <div className="space-y-3">
            {activityRows.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <span className="text-xs font-semibold text-slate-800">{row.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(row.value / activityMax) * 100}%`, background: row.color }} />
                </div>
              </div>
            ))}
          </div>
        </PanelCard>

        {/* Readiness score history */}
        <PanelCard title="Readiness score history" subtitle="Report snapshots over time" onClick={() => setOpen("readiness")}>
          {analytics.readinessSnapshots.length === 0 ? (
            <p className="text-sm text-slate-400">No diligence reports yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.readinessSnapshots.map((row) => (
                <div key={row.createdAt}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString("en-US", {
                        timeZone: "UTC",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{row.score ?? "—"}</span>
                  </div>
                  {row.score != null && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${row.score}%`,
                          background: row.score >= 80 ? "#3B6D11" : row.score >= 50 ? "#534AB7" : "#854F0B",
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </section>

      {/* Centered 448 × 536 slide-up modal */}
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "rgba(12, 35, 64, 0.35)" }}
          onClick={() => setOpen(null)}
        />
        <div
          className="relative w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
          style={{
            maxWidth: 448,
            maxHeight: 536,
            transform: open ? "translateY(0)" : "translateY(40px)",
            transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {open && (
            <DrawerContent drawerKey={open} analytics={analytics} onClose={() => setOpen(null)} />
          )}
        </div>
      </div>
    </>
  );
}
