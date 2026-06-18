import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export const dynamic = "force-dynamic";

const TOOLS = [
  {
    href: "/founder/term-sheet",
    label: "Term sheet explainer",
    description: "Decode every clause in a term sheet — valuation, pro-rata rights, liquidation preferences, anti-dilution, and more.",
    icon: "📄",
    tag: "Education",
  },
  {
    href: "/founder/pitch-practice",
    label: "Pitch practice simulator",
    description: "Simulate tough investor Q&A. Get coached on your answers before you're in the room.",
    icon: "🎤",
    tag: "Practice",
  },
  {
    href: "/founder/email-sequence",
    label: "Email sequence builder",
    description: "Build a structured investor outreach sequence — cold intro, follow-up, and closing emails.",
    icon: "✉️",
    tag: "Outreach",
  },
  {
    href: "/founder/due-diligence",
    label: "Due diligence checklist",
    description: "Know exactly what investors will ask for and get your data room ready before they do.",
    icon: "✅",
    tag: "Preparation",
  },
  {
    href: "/founder/investor-update",
    label: "Investor update builder",
    description: "Write clear, consistent monthly or quarterly updates that keep your investors engaged.",
    icon: "📊",
    tag: "Communication",
  },
  {
    href: "/founder/funding-timeline",
    label: "Funding timeline planner",
    description: "Map out your raise from first outreach to close — milestones, lead time, and runway math.",
    icon: "📅",
    tag: "Planning",
  },
  {
    href: "/founder/board-prep",
    label: "Board meeting prep kit",
    description: "Structure your board deck, anticipate tough questions, and run a meeting investors respect.",
    icon: "🏛️",
    tag: "Governance",
  },
  {
    href: "/founder/kpi-glossary",
    label: "KPI glossary",
    description: "Every metric investors care about — ARR, burn multiple, CAC payback, NRR — explained clearly.",
    icon: "📚",
    tag: "Reference",
  },
] as const;

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Education:     { bg: "#EEF2FF", text: "#4338CA" },
  Practice:      { bg: "#FDF4FF", text: "#7E22CE" },
  Outreach:      { bg: "#ECFDF5", text: "#065F46" },
  Preparation:   { bg: "#FFFBEB", text: "#92400E" },
  Communication: { bg: "#EFF6FF", text: "#1D4ED8" },
  Planning:      { bg: "#FFF7ED", text: "#9A3412" },
  Governance:    { bg: "#F0FDF4", text: "#14532D" },
  Reference:     { bg: "#F8FAFC", text: "#475569" },
};

export default async function RaiseToolkitPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="dashboard">
        <PageHeader
          eyebrow="Raise Toolkit"
          title="Fundraising tools"
          description="Everything you need to prepare, practice, and close your round."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
            marginTop: 8,
          }}
        >
          {TOOLS.map((tool) => {
            const color = TAG_COLORS[tool.tag] ?? TAG_COLORS["Reference"];
            return (
              <Link
                key={tool.href}
                href={tool.href}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    background: "white",
                    border: "0.5px solid #e2e8f0",
                    borderRadius: 14,
                    padding: "20px 22px",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    cursor: "pointer",
                    transition: "box-shadow 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(83,74,183,0.10)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#c7d2fe";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0";
                  }}
                >
                  {/* Icon + tag row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 28, lineHeight: 1 }}>{tool.icon}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: ".05em",
                        textTransform: "uppercase",
                        padding: "3px 9px",
                        borderRadius: 20,
                        background: color.bg,
                        color: color.text,
                      }}
                    >
                      {tool.tag}
                    </span>
                  </div>

                  {/* Label */}
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: 0, lineHeight: 1.3 }}>
                    {tool.label}
                  </p>

                  {/* Description */}
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.6, flexGrow: 1 }}>
                    {tool.description}
                  </p>

                  {/* CTA */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#534AB7" }}>Open tool</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </FounderFeatureGate>
    </FounderAppShell>
  );
}
