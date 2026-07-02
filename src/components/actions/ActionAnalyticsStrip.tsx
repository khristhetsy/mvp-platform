import type { ActionCenterAnalytics } from "@/lib/actions/types";
import { useTranslations } from "next-intl";
import type { NextBestActionRole } from "@/lib/next-best-actions/types";

// ─── Icon SVGs ────────────────────────────────────────────────────────────────

function IconActivity({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconAlertCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconArrowUp({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function IconCheckCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconZap({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconClock({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconBriefcase({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  iconBg,
  valueFg,
}: Readonly<{
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  valueFg?: string;
}>) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "0.5px solid #e2e6ed",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 9,
            background: iconBg,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            color: valueFg ?? "#0c2340",
          }}
        >
          {value}
        </span>
      </div>
      <p
        style={{
          marginTop: 10,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#64748b",
        }}
      >
        {label}
      </p>
    </div>
  );
}

// ─── Strip ────────────────────────────────────────────────────────────────────

export function ActionAnalyticsStrip({
  analytics,
  role,
}: Readonly<{ analytics: ActionCenterAnalytics; role: NextBestActionRole }>) {
  const t = useTranslations("sharedCmp");
  if (role === "founder") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("active")}
          value={analytics.open}
          icon={<IconActivity color="#2E78F5" />}
          iconBg="#EEEDFB"
          valueFg="#1A6CE4"
        />
        <StatCard
          label={t("overdue")}
          value={analytics.overdue}
          icon={<IconAlertCircle color="#A32D2D" />}
          iconBg="#FCEBEB"
          valueFg={analytics.overdue > 0 ? "#A32D2D" : "#0c2340"}
        />
        <StatCard
          label={t("escalated")}
          value={analytics.escalated}
          icon={<IconArrowUp color="#854F0B" />}
          iconBg="#FEF3CD"
          valueFg={analytics.escalated > 0 ? "#854F0B" : "#0c2340"}
        />
        <StatCard
          label={t("completed_this_week")}
          value={analytics.completedThisWeek}
          icon={<IconCheckCircle color="#3B6D11" />}
          iconBg="#E1F5EE"
          valueFg="#3B6D11"
        />
      </div>
    );
  }

  if (role === "investor") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("pending_requirements")}
          value={analytics.pendingRequirements ?? 0}
          icon={<IconClock color="#2E78F5" />}
          iconBg="#EEEDFB"
          valueFg="#1A6CE4"
        />
        <StatCard
          label={t("overdue")}
          value={analytics.overdue}
          icon={<IconAlertCircle color="#A32D2D" />}
          iconBg="#FCEBEB"
          valueFg={analytics.overdue > 0 ? "#A32D2D" : "#0c2340"}
        />
        <StatCard
          label={t("completed_this_week")}
          value={analytics.completedThisWeek}
          icon={<IconCheckCircle color="#3B6D11" />}
          iconBg="#E1F5EE"
          valueFg="#3B6D11"
        />
        <StatCard
          label={t("active_opportunities")}
          value={analytics.activeOpportunities ?? 0}
          icon={<IconBriefcase color="#0369a1" />}
          iconBg="#E0F2FE"
          valueFg="#0369a1"
        />
      </div>
    );
  }

  // Admin / analyst
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        label={t("critical")}
        value={analytics.critical}
        icon={<IconZap color="#A32D2D" />}
        iconBg="#FCEBEB"
        valueFg={analytics.critical > 0 ? "#A32D2D" : "#0c2340"}
      />
      <StatCard
        label={t("escalated")}
        value={analytics.escalated}
        icon={<IconArrowUp color="#854F0B" />}
        iconBg="#FEF3CD"
        valueFg={analytics.escalated > 0 ? "#854F0B" : "#0c2340"}
      />
      <StatCard
        label={t("overdue")}
        value={analytics.overdue}
        icon={<IconAlertCircle color="#A32D2D" />}
        iconBg="#FCEBEB"
        valueFg={analytics.overdue > 0 ? "#A32D2D" : "#0c2340"}
      />
      <StatCard
        label={t("blocked")}
        value={analytics.blocked}
        icon={<IconClock color="#854F0B" />}
        iconBg="#FEF3CD"
        valueFg={analytics.blocked > 0 ? "#854F0B" : "#0c2340"}
      />
      <StatCard
        label={t("completed_today")}
        value={analytics.completedToday}
        icon={<IconCheckCircle color="#3B6D11" />}
        iconBg="#E1F5EE"
        valueFg="#3B6D11"
      />
    </div>
  );
}
