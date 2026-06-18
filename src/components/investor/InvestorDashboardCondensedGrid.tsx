import Link from "next/link";
import { InvestorMatchOpportunityCardCompact } from "@/components/InvestorMatchOpportunityCardCompact";
import type { InvestorActivityRow } from "@/lib/data/investor-crm";
import type { CompanyMatchProfile } from "@/lib/matching/investor-company-matching";

type MatchRow = {
  company: CompanyMatchProfile;
  matchScore: number;
};

// SVG icon paths keyed by activity type (viewBox 0 0 24 24, stroke-based)
const ACTIVITY_ICON: Record<string, React.ReactElement> = {
  expressed_interest: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  requested_intro: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  message_sent: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  message_thread_created: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  saved_deal: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  report_viewed: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  meeting_requested: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  meeting_accepted: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      <polyline points="9 16 11 18 15 14" />
    </svg>
  ),
  pledge_amount_submitted: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  spv_interest_expressed: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="22" x2="21" y2="22" /><rect x="2" y="11" width="20" height="11" rx="2" /><path d="M12 2L2 7h20L12 2z" />
    </svg>
  ),
  follow_up_requested: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  meeting_declined: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      <line x1="10" y1="14" x2="14" y2="18" /><line x1="14" y1="14" x2="10" y2="18" />
    </svg>
  ),
};

const ACTIVITY_LABEL: Record<string, string> = {
  expressed_interest: "Expressed interest",
  requested_intro: "Intro requested",
  message_sent: "Message sent",
  message_thread_created: "Thread started",
  saved_deal: "Deal saved",
  report_viewed: "Report viewed",
  meeting_requested: "Meeting requested",
  meeting_accepted: "Meeting accepted",
  pledge_amount_submitted: "Pledge submitted",
  spv_interest_expressed: "SPV interest",
  follow_up_requested: "Follow-up",
  meeting_declined: "Meeting declined",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function formatCurrency(amount: number | null): string | null {
  if (amount == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(12,35,64,.05)",
};

const cardHeader: React.CSSProperties = {
  padding: "14px 16px 10px",
  borderBottom: "0.5px solid #f1f5f9",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const cardTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#0f172a",
};

const viewLink: React.CSSProperties = {
  fontSize: 12,
  color: "#534AB7",
  textDecoration: "none",
  fontWeight: 500,
  whiteSpace: "nowrap",
};

export function InvestorDashboardCondensedGrid({
  watchlistCount,
  interestCount,
  introCount,
  topMatches,
  recentActivity,
}: Readonly<{
  watchlistCount: number;
  interestCount: number;
  introCount: number;
  topMatches: MatchRow[];
  recentActivity: InvestorActivityRow[];
}>) {
  const topActivity = recentActivity.slice(0, 3);
  const weeklyTotal = watchlistCount + interestCount + introCount;
  const goalPct = Math.min(100, Math.round((weeklyTotal / 10) * 100));

  return (
    <div className="flex flex-col gap-4">

      {/* ── Row 1: 3 equal columns (stacks on mobile → 2-col on sm → 3-col on lg) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

        {/* Engagement Pipeline */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Engagement Pipeline</span>
            <Link href="/investor/opportunities" style={viewLink}>View →</Link>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Watchlist", count: watchlistCount, color: "#6366f1", href: "/investor/watchlist" },
              { label: "Interests",  count: interestCount,  color: "#534AB7", href: "/investor/interest-pipeline" },
              { label: "Intros",     count: introCount,     color: "#7c3aed", href: "/investor/interest-pipeline" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#475569" }}>{row.label}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Momentum */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Pipeline Momentum</span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#dcfce7", color: "#166534" }}>
              Active
            </span>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              This week
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <div style={{ background: "#EEEDFE", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#534AB7" }}>{watchlistCount}</div>
                <div style={{ fontSize: 10, color: "#534AB7", marginTop: 2 }}>Saved deals</div>
              </div>
              <div style={{ background: "#e0e7ff", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#4f46e5" }}>{introCount}</div>
                <div style={{ fontSize: 10, color: "#4f46e5", marginTop: 2 }}>Intros sent</div>
              </div>
            </div>
            <div style={{ background: "#f1f5f9", borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{ background: "#534AB7", height: "100%", width: `${goalPct}%`, borderRadius: 99 }} />
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>{goalPct}% of weekly goal</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Recent Activity</span>
            <Link href="/investor/activity" style={viewLink}>View all →</Link>
          </div>
          <div style={{ padding: "6px 0" }}>
            {topActivity.length === 0 ? (
              <p style={{ fontSize: 12, color: "#94a3b8", padding: "20px 16px", textAlign: "center" }}>
                No recent activity.
              </p>
            ) : (
              topActivity.map((row) => {
                const icon = ACTIVITY_ICON[row.activity_type] ?? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                );
                const label = ACTIVITY_LABEL[row.activity_type] ?? "Activity";
                return (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: "0.5px solid #f8fafc" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {row.company_id ? (
                        <Link
                          href={`/investor/opportunities/${row.company_id}/report`}
                          style={{ fontSize: 12, fontWeight: 600, color: "#534AB7", textDecoration: "none", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {row.company_name ?? "Company"} →
                        </Link>
                      ) : (
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {row.company_name ?? "Company"}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>
                        {label} · {relativeTime(row.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Portfolio (1) + Recommended (2) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">

        {/* Portfolio */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Portfolio</span>
            <Link href="/investor/portfolio" style={viewLink}>Open →</Link>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginBottom: 12 }}>
              Saved deals, interests, SPV participations and founder updates.
            </p>
            <div style={{ background: "#f8fafc", border: "0.5px solid #e2e6ed", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 12, color: "#64748b" }}>
              <strong style={{ color: "#0f172a" }}>{introCount}</strong>{" "}
              intro {introCount === 1 ? "request" : "requests"} pending follow-up.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {[
                { val: watchlistCount, label: "Saved",    color: "#6366f1", bg: "#e0e7ff" },
                { val: interestCount,  label: "Interest", color: "#534AB7", bg: "#EEEDFE" },
                { val: introCount,     label: "Intros",   color: "#7c3aed", bg: "#ede9fe" },
              ].map((s) => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: s.color, marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommended for you */}
        <div style={card}>
          <div style={cardHeader}>
            <div>
              <div style={cardTitle}>Recommended for you</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Match score from your onboarding preferences</div>
            </div>
            <Link href="/investor/opportunities" style={viewLink}>View all matches →</Link>
          </div>
          <div style={{ padding: "14px 16px" }}>
            {topMatches.length === 0 ? (
              <p style={{ fontSize: 12, color: "#94a3b8" }}>
                No published listings yet. Complete onboarding to improve matches.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {topMatches.map((row) => (
                  <InvestorMatchOpportunityCardCompact
                    key={row.company.id}
                    companyId={row.company.id}
                    companyName={row.company.companyName}
                    industry={row.company.industry}
                    stage={row.company.stage}
                    location={row.company.geography}
                    fundingTarget={formatCurrency(row.company.fundingAmount)}
                    matchScore={row.matchScore}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
