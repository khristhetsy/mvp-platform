import Link from "next/link";
import { useTranslations } from "next-intl";

const CIRC = 2 * Math.PI * 17; // r=17 → ≈106.8

function donutColor(score: number): string {
  if (score >= 85) return "#2E78F5";
  if (score >= 70) return "#6366f1";
  return "#2563eb";
}

export function InvestorMatchOpportunityCardCompact({
  companyId,
  companyName,
  industry,
  stage,
  location,
  fundingTarget,
  matchScore,
}: Readonly<{
  companyId: string;
  companyName: string;
  industry: string | null;
  stage: string | null;
  location: string | null;
  fundingTarget: string | null;
  matchScore: number;
}>) {
  const t = useTranslations("sharedCmp");
  const color = donutColor(matchScore);
  const offset = CIRC * (1 - matchScore / 100);
  const meta = [industry, stage].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/investor/opportunities/${companyId}/report`}
      style={{
        textDecoration: "none",
        display: "block",
        background: "#f8fafc",
        border: "0.5px solid #e2e6ed",
        borderRadius: 10,
        padding: 12,
        transition: "box-shadow .15s, border-color .15s",
      }}
      className="group hover:border-[#2E78F5] hover:shadow-[0_4px_14px_rgba(83,74,183,.15)]"
    >
      {/* Top row: donut + company info */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {/* Donut SVG */}
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
          <circle cx="22" cy="22" r="17" fill="none" stroke="#e0e7ff" strokeWidth="5.5" />
          <circle
            cx="22"
            cy="22"
            r="17"
            fill="none"
            stroke={color}
            strokeWidth="5.5"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 22 22)"
          />
          <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
            {matchScore}%
          </text>
        </svg>

        {/* Company info */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#0f172a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {companyName}
          </div>
          {meta && (
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{meta}</div>
          )}
          {location && (
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{location}</div>
          )}
        </div>
      </div>

      {/* Bottom row: funding + view link */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {fundingTarget ? (
          <span style={{ fontSize: 10, fontWeight: 600, color: "#475569" }}>
            Raising {fundingTarget}
          </span>
        ) : (
          <span />
        )}
        <span style={{ fontSize: 10, fontWeight: 600, color: "#2E78F5" }}>{t("view_2")}</span>
      </div>
    </Link>
  );
}
