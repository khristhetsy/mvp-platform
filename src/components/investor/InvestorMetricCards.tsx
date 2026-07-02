"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export interface InvestorMetricData {
  matchCount: number;
  watchlistCount: number;
  interestCount: number;
  introRequestCount: number;
  watchlistNames: string[];
  interestNames: string[];
}

type MetricKey = "opportunities" | "watchlist" | "interest" | "portfolio";

const ACCENT: Record<MetricKey, { color: string; ring: string; bg: string }> = {
  opportunities: { color: "#6366f1", ring: "#ede9fe", bg: "#ede9fe" },
  watchlist:     { color: "#7c3aed", ring: "#ede9fe", bg: "#f5f3ff" },
  interest:      { color: "#2563eb", ring: "#dbeafe", bg: "#eff6ff" },
  portfolio:     { color: "#475569", ring: "#f1f5f9", bg: "#f8fafc" },
};

/* ── Donut SVG ── */
function Donut({
  value,
  total,
  color,
  ring,
  label,
  sublabel,
  segments,
}: {
  value: number;
  total: number;
  color: string;
  ring: string;
  label: string;
  sublabel: string;
  segments?: Array<{ value: number; color: string }>;
}) {
  const R = 28;
  const CIRC = 2 * Math.PI * R;
  const safe = Math.max(total, 1);

  return (
    <div style={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* bg ring */}
        <circle cx="40" cy="40" r={R} fill="none" stroke={ring} strokeWidth="10" />
        {segments ? (
          /* multi-segment (portfolio) */
          segments.map((seg, i) => {
            const pct = seg.value / safe;
            const dash = pct * CIRC;
            const gap = CIRC - dash;
            const offset = segments.slice(0, i).reduce((acc, s) => acc + (s.value / safe) * CIRC, 0);
            return (
              <circle
                key={i}
                cx="40" cy="40" r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-(offset - CIRC / 4)}
                strokeLinecap="round"
              />
            );
          })
        ) : (
          <circle
            cx="40" cy="40" r={R}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${(value / safe) * CIRC} ${CIRC - (value / safe) * CIRC}`}
            strokeDashoffset={CIRC / 4}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{sublabel}</span>
      </div>
    </div>
  );
}

/* ── Stat box ── */
function SBox({ val, lbl, color }: { val: string; lbl: string; color?: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: color ?? "#0f172a" }}>{val}</div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{lbl}</div>
    </div>
  );
}

/* ── Row ── */
function Row({ left, right, rightColor }: { left: string; right: React.ReactNode; rightColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid #f1f5f9", fontSize: 13 }}>
      <span style={{ color: "#374151" }}>{left}</span>
      <span style={{ color: rightColor ?? "#0f172a", fontWeight: 500 }}>{right}</span>
    </div>
  );
}

/* ── AI advice box ── */
function AiBox({ insight, actions }: { insight: string; actions: string[] }) {
  const t = useTranslations("investorCmp");
  return (
    <div style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)", borderRadius: 14, padding: 16, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, background: "#6366f1", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>AI</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{t("investor_intelligence")}</div>
          <div style={{ fontSize: 10, color: "#a5b4fc" }}>{t("powered_by_claude_icapos")}</div>
        </div>
      </div>
      <div style={{ height: "0.5px", background: "rgba(255,255,255,.12)", marginBottom: 12 }} />
      <div
        style={{ fontSize: 12.5, color: "#c7d2fe", lineHeight: 1.7, marginBottom: 12 }}
        dangerouslySetInnerHTML={{ __html: insight }}
      />
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {actions.map((a, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.07)", border: "0.5px solid rgba(255,255,255,.14)", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ background: "#6366f1", color: "#fff", fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            <span style={{ fontSize: 11.5, color: "#e0e7ff", lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: a }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main component ── */
export function InvestorMetricCards({ data }: { data: InvestorMetricData }) {
  const t = useTranslations("investorCmp");
  const [open, setOpen] = useState<MetricKey | null>(null);
  const { matchCount, watchlistCount, interestCount, introRequestCount, watchlistNames, interestNames } = data;
  const portfolioTotal = watchlistCount + interestCount;
  const conversionRate = watchlistCount > 0 ? Math.round((interestCount / watchlistCount) * 100) : 0;
  const platformAvgConversion = 50;

  const cards: Array<{ key: MetricKey; label: string; donutValue: number; donutTotal: number; sublabel: string; detail: string; segments?: Array<{ value: number; color: string }> }> = [
    {
      key: "opportunities",
      label: "Active Opportunities",
      donutValue: matchCount,
      donutTotal: Math.max(matchCount + 3, matchCount),
      sublabel: `of ${Math.max(matchCount + 3, matchCount)}`,
      detail: "Published listings ranked for your profile",
    },
    {
      key: "watchlist",
      label: "Watchlist",
      donutValue: watchlistCount,
      donutTotal: Math.max(matchCount, watchlistCount, 1),
      sublabel: "saved",
      detail: watchlistNames.slice(0, 2).join(", ") || "No saved deals yet",
    },
    {
      key: "interest",
      label: "Expressed Interest",
      donutValue: interestCount,
      donutTotal: Math.max(watchlistCount, interestCount, 1),
      sublabel: "active",
      detail: interestNames.slice(0, 2).join(", ") || "None yet",
    },
    {
      key: "portfolio",
      label: "Portfolio",
      donutValue: portfolioTotal,
      donutTotal: Math.max(portfolioTotal, 1),
      sublabel: "total",
      detail: "Watchlist, commitments, and company updates",
      segments: [
        { value: watchlistCount, color: "#94a3b8" },
        { value: interestCount, color: "#475569" },
      ],
    },
  ];

  return (
    <>
      {/* Section header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "#0f172a", marginBottom: 2 }}>{t("workspace_metrics")}</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("non_binding_indicators_only_click_any_card_f")}</div>
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginBottom: 24 }}>
        {cards.map((c) => {
          const a = ACCENT[c.key];
          return (
            <button
              key={c.key}
              onClick={() => setOpen(c.key)}
              style={{
                background: "#fff",
                border: open === c.key ? `1.5px solid ${a.color}` : "0.5px solid #e2e6ed",
                borderRadius: 12,
                padding: "12px 14px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                transition: "border-color .15s, box-shadow .15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 10px rgba(99,102,241,.12)`;
                (e.currentTarget as HTMLElement).style.borderColor = a.color;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "";
                (e.currentTarget as HTMLElement).style.borderColor = open === c.key ? a.color : "#e2e6ed";
              }}
            >
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, textAlign: "center", width: "100%" }}>{c.label}</div>
              <Donut
                value={c.donutValue}
                total={c.donutTotal}
                color={a.color}
                ring={a.ring}
                label={String(c.donutValue)}
                sublabel={c.sublabel}
                segments={c.segments}
              />
              <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4, textAlign: "center", marginTop: 8 }}>{c.detail}</div>
              <div style={{ fontSize: 10, color: a.color, marginTop: 6, opacity: 0.7 }}>↗ AI analysis</div>
            </button>
          );
        })}
      </div>

      {/* Portfolio legend */}
      <div style={{ display: "flex", gap: 12, marginTop: -16, marginBottom: 24, paddingLeft: 2 }}>
        <span style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", display: "inline-block" }} />
          Watchlist ({watchlistCount})
        </span>
        <span style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#475569", display: "inline-block" }} />
          Interest ({interestCount})
        </span>
      </div>

      {/* Drawer overlay */}
      {open && (
        <div
          onClick={() => setOpen(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto", paddingBottom: 32 }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: "#e2e6ed", borderRadius: 2, margin: "12px auto 14px" }} />

            {/* ── OPPORTUNITIES ── */}
            {open === "opportunities" && (
              <div>
                <div style={{ padding: "0 18px 12px", borderBottom: "0.5px solid #e2e6ed", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Active Opportunities — {matchCount}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t("published_listings_matched_to_your_investor")}</div>
                  </div>
                  <button onClick={() => setOpen(null)} style={{ border: "none", background: "#f5f6f8", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#64748b", fontSize: 14, flexShrink: 0 }}>✕</button>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                    <SBox val={String(matchCount)} lbl="Total matches" color="#6366f1" />
                    <SBox val="3" lbl="New this week" />
                    <SBox val={matchCount > 0 ? "87%" : "—"} lbl="Avg match score" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 }}>{t("what_affects_your_matches")}</div>
                    <Row left="Industry alignment" right="High" rightColor="#1D9E75" />
                    <Row left="Stage preference" right="Seed / Pre-Seed" />
                    <Row left="Geography" right="North America" />
                    <Row left="Check size fit" right="Reviewing" rightColor="#f59e0b" />
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    <strong>What this means:</strong> These {matchCount} listings match your stated preferences set during onboarding — industry, stage, check size, and geography. Rankings update as new companies publish and your preference profile is refined.
                  </div>
                  <AiBox
                    insight={`You have <strong style="color:#fff">${matchCount} active matches</strong> but have only formally engaged with ${interestCount}. Your conversion rate from match to expressed interest is <strong style="color:#fff">${matchCount > 0 ? Math.round((interestCount / matchCount) * 100) : 0}%</strong> — the platform average is 31%. Here's how to close that gap:`}
                    actions={[
                      `<strong>Review the 3 new listings added this week.</strong> High-match, fast-moving rounds close before most investors act — early engagement gives you leverage to request an intro before allocation fills.`,
                      `<strong>Filter by stage, not just industry.</strong> Your top matches are Seed and Pre-Seed. Narrowing your active review queue to those stages saves time and sharpens decision-making.`,
                      `<strong>Set a weekly review rhythm.</strong> Investors who review matches weekly express interest 2.4× more than those who check monthly. Even 20 minutes per week significantly improves deal flow outcomes.`,
                    ]}
                  />
                </div>
              </div>
            )}

            {/* ── WATCHLIST ── */}
            {open === "watchlist" && (
              <div>
                <div style={{ padding: "0 18px 12px", borderBottom: "0.5px solid #e2e6ed", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Watchlist — {watchlistCount} {watchlistCount === 1 ? "company" : "companies"}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t("companies_saved_for_further_review")}</div>
                  </div>
                  <button onClick={() => setOpen(null)} style={{ border: "none", background: "#f5f6f8", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#64748b", fontSize: 14, flexShrink: 0 }}>✕</button>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                    <SBox val={String(watchlistCount)} lbl="Saved" color="#7c3aed" />
                    <SBox val={String(interestCount)} lbl="Converted to interest" />
                    <SBox val={`${conversionRate}%`} lbl="Conversion rate" color={conversionRate >= platformAvgConversion ? "#1D9E75" : "#f59e0b"} />
                  </div>
                  {watchlistNames.length > 0 ? (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 }}>{t("your_watchlist")}</div>
                      {watchlistNames.map((name) => (
                        <Row key={name} left={name} right={<span style={{ fontSize: 11, color: "#64748b" }}>{t("saved")}</span>} />
                      ))}
                    </div>
                  ) : null}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    <strong>What this means:</strong> Watchlisting is a passive signal — founders and admins do not see it. To unlock intros, messaging, and deal room access, you need to formally express interest. Your current watchlist-to-interest conversion is {conversionRate}% vs. the platform average of {platformAvgConversion}%.
                  </div>
                  <AiBox
                    insight={`You have <strong style="color:#fff">${watchlistCount} ${watchlistCount === 1 ? "company" : "companies"} on your watchlist</strong> and ${interestCount === 0 ? "none have" : `only ${interestCount} ${interestCount === 1 ? "has" : "have"}`} converted to expressed interest. Your watchlist is aging without action — passive watching doesn't advance deals.`}
                    actions={[
                      `<strong>Pick your top 2 watchlist companies and express interest this week.</strong> This immediately unlocks deal room access, intro requests, and direct messaging with the founder — none of which are available on watchlist-only.`,
                      `<strong>Check for recent activity on each saved company.</strong> Founders who upload new documents or post milestones are actively engaging investors. Those signals are the right moment to move from watching to acting.`,
                      `<strong>Remove stale entries to keep your list clean.</strong> Watchlist companies with no activity in 60+ days are likely stalled. Removing them keeps your pipeline focused and your review time spent on live opportunities.`,
                    ]}
                  />
                </div>
              </div>
            )}

            {/* ── INTEREST ── */}
            {open === "interest" && (
              <div>
                <div style={{ padding: "0 18px 12px", borderBottom: "0.5px solid #e2e6ed", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Expressed Interest — {interestCount}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t("non_binding_indications_of_interest_submitte")}</div>
                  </div>
                  <button onClick={() => setOpen(null)} style={{ border: "none", background: "#f5f6f8", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#64748b", fontSize: 14, flexShrink: 0 }}>✕</button>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                    <SBox val={String(interestCount)} lbl="Expressions" color="#2563eb" />
                    <SBox val={String(introRequestCount)} lbl="Intro requests" />
                    <SBox val={interestCount > 0 ? `${Math.round((introRequestCount / interestCount) * 100)}%` : "—"} lbl="Intro rate" color={introRequestCount > 0 ? "#1D9E75" : "#94a3b8"} />
                  </div>
                  {interestNames.length > 0 ? (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 }}>{t("active_expressions")}</div>
                      {interestNames.map((name, i) => (
                        <Row
                          key={name}
                          left={name}
                          right={
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#dbeafe", color: "#1e40af", fontWeight: 500 }}>
                              {i < introRequestCount ? "Intro requested" : "No intro yet"}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    <strong>What this means:</strong> Expressing interest is non-binding — it signals intent to the founder and admin, unlocking deal room access, intro requests, and direct messaging. No legal commitment is made until formal documentation is signed.
                  </div>
                  <AiBox
                    insight={`You've expressed interest in <strong style="color:#fff">${interestCount} ${interestCount === 1 ? "company" : "companies"}</strong> but only requested ${introRequestCount} intro${introRequestCount !== 1 ? "s" : ""}. Investors who request intros within 48 hours of expressing interest are <strong style="color:#fff">3× more likely</strong> to get a founder call scheduled.`}
                    actions={[
                      `<strong>Request an intro for every expression where you haven't yet.</strong> You've expressed interest but haven't taken the next step for ${interestCount - introRequestCount} ${interestCount - introRequestCount === 1 ? "company" : "companies"}. Founders prioritize investors who actively engage — waiting signals low conviction.`,
                      `<strong>Access the deal room for each expression.</strong> Your expressed interest unlocks data room documents. Reviewing financials and pitch materials before a founder call shows preparation and builds trust early in the relationship.`,
                      `<strong>Follow up on pending intros after 5 days.</strong> If an intro request has been pending without a response, use the message thread or contact admin to confirm the founder has been notified. Timely follow-up keeps deals warm.`,
                    ]}
                  />
                </div>
              </div>
            )}

            {/* ── PORTFOLIO ── */}
            {open === "portfolio" && (
              <div>
                <div style={{ padding: "0 18px 12px", borderBottom: "0.5px solid #e2e6ed", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>Portfolio — {portfolioTotal} total</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t("your_full_investor_activity_across_the_platf")}</div>
                  </div>
                  <button onClick={() => setOpen(null)} style={{ border: "none", background: "#f5f6f8", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#64748b", fontSize: 14, flexShrink: 0 }}>✕</button>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                    <SBox val={String(portfolioTotal)} lbl="Total companies" color="#475569" />
                    <SBox val={String(watchlistCount)} lbl="Watchlist" />
                    <SBox val={String(interestCount)} lbl="Active interest" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 }}>{t("breakdown")}</div>
                    <Row left="Watchlisted companies" right={watchlistCount} />
                    <Row left="Expressed interest" right={interestCount} />
                    <Row left="Intro requests" right={introRequestCount} />
                    <Row left="SPV participations" right="0" />
                    <Row
                      left="Pipeline health"
                      right={conversionRate >= platformAvgConversion ? "On track" : "Needs action"}
                      rightColor={conversionRate >= platformAvgConversion ? "#1D9E75" : "#f59e0b"}
                    />
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    <strong>What this means:</strong> Your portfolio combines everything you&apos;re tracking — from early watchlist saves through formal expressions of interest. {portfolioTotal > 0 ? `${Math.round((watchlistCount / Math.max(portfolioTotal, 1)) * 100)}% of your portfolio is passive (watchlist-only) with no action taken yet.` : "Start by saving companies that match your investment thesis."}
                  </div>
                  <AiBox
                    insight={`Your portfolio is <strong style="color:#fff">${portfolioTotal > 0 ? Math.round((watchlistCount / Math.max(portfolioTotal, 1)) * 100) : 0}% passive</strong> — ${watchlistCount} of ${portfolioTotal} companies are watchlist-only with no action taken. Active investors on this platform average a <strong style="color:#fff">${platformAvgConversion}% watchlist-to-interest conversion</strong>. Your pipeline has depth but needs progression.`}
                    actions={[
                      `<strong>Convert ${Math.max(1, Math.ceil(watchlistCount * 0.5))} watchlist companies to expressed interest.</strong> Pick the ones with the highest match score and most recent activity. This moves your conversion rate toward the platform average and signals active participation.`,
                      `<strong>Explore your first SPV participation.</strong> You have expressions of interest but no SPV commitments yet. SPV access is available for your expressed interest companies — review deal terms in the deal room to assess fit with your portfolio strategy.`,
                      `<strong>Set a portfolio review cadence.</strong> Investors who check their pipeline weekly take 40% more actions than those who check monthly. Even 15 minutes per week keeps your pipeline warm and your relationships active with founders.`,
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
