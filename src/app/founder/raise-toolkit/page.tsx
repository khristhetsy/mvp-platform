import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

export const dynamic = "force-dynamic";

// SVG path data for each tool icon (24×24 viewBox, stroke-based)
const TOOL_ICONS: Record<string, { path: string; color: string }> = {
  document: {
    path: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z",
    color: "#4338CA",
  },
  microphone: {
    path: "M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V22h2v-3.07A8 8 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z",
    color: "#7E22CE",
  },
  envelope: {
    path: "M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4.7-8 5-8-5V6l8 5 8-5v2.7z",
    color: "#065F46",
  },
  checklist: {
    path: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    color: "#92400E",
  },
  barchart: {
    path: "M18 20V10M12 20V4M6 20v-6",
    color: "#1D4ED8",
  },
  calendar: {
    path: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18",
    color: "#9A3412",
  },
  columns: {
    path: "M2 20h20M4 20V9M8 20V5M12 20V9M16 20V5M20 20V9",
    color: "#14532D",
  },
  book: {
    path: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z",
    color: "#475569",
  },
  sparkles: {
    path: "M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z",
    color: "#3C3489",
  },
};

function ToolIcon({ name }: Readonly<{ name: string }>) {
  const icon = TOOL_ICONS[name];
  if (!icon) return null;
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: `${icon.color}14`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d={icon.path} stroke={icon.color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const TOOLS = [
  {
    href: "/founder/term-sheet",
    label: "Term sheet explainer",
    description: "Decode every clause in a term sheet — valuation, pro-rata rights, liquidation preferences, anti-dilution, and more.",
    icon: "document",
    tag: "Education",
  },
  {
    href: "/founder/pitch-practice",
    label: "Pitch practice simulator",
    description: "Simulate tough investor Q&A. Get coached on your answers before you're in the room.",
    icon: "microphone",
    tag: "Practice",
  },
  {
    href: "/founder/email-sequence",
    label: "Email sequence builder",
    description: "Build a structured investor outreach sequence — cold intro, follow-up, and closing emails.",
    icon: "envelope",
    tag: "Outreach",
  },
  {
    href: "/founder/due-diligence",
    label: "Due diligence checklist",
    description: "Know exactly what investors will ask for and get your data room ready before they do.",
    icon: "checklist",
    tag: "Preparation",
  },
  {
    href: "/founder/investor-update",
    label: "Investor update builder",
    description: "Write clear, consistent monthly or quarterly updates that keep your investors engaged.",
    icon: "barchart",
    tag: "Communication",
  },
  {
    href: "/founder/funding-timeline",
    label: "Funding timeline planner",
    description: "Map out your raise from first outreach to close — milestones, lead time, and runway math.",
    icon: "calendar",
    tag: "Planning",
  },
  {
    href: "/founder/board-prep",
    label: "Board meeting prep kit",
    description: "Structure your board deck, anticipate tough questions, and run a meeting investors respect.",
    icon: "columns",
    tag: "Governance",
  },
  {
    href: "/founder/kpi-glossary",
    label: "KPI glossary",
    description: "Every metric investors care about — ARR, burn multiple, CAC payback, NRR — explained clearly.",
    icon: "book",
    tag: "Reference",
  },
  {
    href: "/founder/pitch-deck-analyzer",
    label: "Pitch deck AI analyzer",
    description: "Get scored, slide-by-slide AI feedback on your pitch deck from the perspective of a top VC.",
    icon: "sparkles",
    tag: "AI",
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
  AI:            { bg: "#EEEDFE", text: "#3C3489" },
};

export default async function RaiseToolkitPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderFeatureGate featureKey="dashboard">
        <PageHeader
          eyebrow={t("raise_toolkit")}
          title={t("fundraising_tools")}
          description={t("everything_you_need_to_prepare_practice_and_cl")}
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
                    <ToolIcon name={tool.icon} />
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#534AB7" }}>{t("open_tool")}</span>
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
