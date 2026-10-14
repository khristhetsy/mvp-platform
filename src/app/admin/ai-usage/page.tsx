import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AiUsageTable } from "@/components/admin/AiUsageTable";
import { MetricRow, OperationalMetric } from "@/components/ui/OperationalMetric";
import { requirePermissionPage } from "@/lib/api/permissions";
import { REPORT_LOOKBACK_DAYS, loadAiUsageReport } from "@/lib/ai-usage/report";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: PLATFORM_TZ });

export default async function AdminAiUsagePage() {
  const { profile } = await requirePermissionPage("manage_settings");
  const report = await loadAiUsageReport();
  const { spend } = report;

  const spendStartsLate =
    report.firstUsageAt !== null && spend.firstAt !== null && new Date(spend.firstAt) > new Date(report.firstUsageAt);

  return (
    <AppShell
      role="ADMIN"
      workspace="admin"
      profileName={profile.full_name ?? profile.email ?? "Admin"}
      profileSubtitle="AI usage and cost"
    >
      <div className="space-y-6">
        <header>
          <h1 className="text-lg font-semibold text-slate-950">AI usage and cost</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Runs per user against the plan limits, and what the AI calls cost. A limit counts runs in a rolling 7 or 30 day
            window, not a calendar month. Change limits in{" "}
            <Link href="/admin/feature-controls" className="font-medium text-indigo-700 hover:text-indigo-600">
              Feature Controls
            </Link>
            .
          </p>
        </header>

        {report.error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Could not load AI usage. {report.error}
          </div>
        ) : (
          <>
            <MetricRow>
              <OperationalMetric
                label="Runs, last 30 days"
                value={report.runs30d.toLocaleString("en-US")}
                detail={`${report.usersWithRuns} users across ${report.toolsUsed} tools`}
              />
              <OperationalMetric
                label="Users at or over a limit"
                value={String(report.blockedUsers)}
                unit={`of ${report.usersWithRuns} users with runs`}
                flag={
                  report.blockedUsers > 0
                    ? { text: "Their next run is blocked until the oldest run ages out of the window.", tone: "bad" }
                    : { text: "No one is blocked right now.", tone: "good" }
                }
              />
              <OperationalMetric
                label="AI cost logged"
                value={spend.events > 0 ? usd(spend.totalUsd) : "None logged"}
                detail={
                  spend.events > 0 && spend.firstAt
                    ? `${spend.events.toLocaleString("en-US")} calls since ${day(spend.firstAt)}`
                    : `No spend rows in the last ${REPORT_LOOKBACK_DAYS} days`
                }
                flag={
                  spendStartsLate && spend.firstAt && report.firstUsageAt
                    ? {
                        text: `Spend logging starts ${day(spend.firstAt)}, usage logging starts ${day(report.firstUsageAt)}. Earlier runs have no cost.`,
                        tone: "warn",
                      }
                    : null
                }
              />
              <OperationalMetric
                label="Cost tied to a user"
                value={spend.totalUsd > 0 ? usd(spend.totalUsd - spend.unattributedUsd) : "Not measured"}
                detail={spend.totalUsd > 0 ? `${(((spend.totalUsd - spend.unattributedUsd) / spend.totalUsd) * 100).toFixed(1)}% of the total` : "No spend rows to measure."}
              />
              <OperationalMetric
                label="User cost not tied to a user"
                value={spend.totalUsd > 0 ? usd(spend.userToolUsd) : "Not measured"}
                detail={spend.totalUsd > 0 ? `${((spend.userToolUsd / spend.totalUsd) * 100).toFixed(1)}% of the total. New runs now carry the user, so this shrinks.` : "No spend rows to measure."}
                flag={spend.userToolUsd > 0 ? { text: "Logged before the user was passed to the AI call.", tone: "warn" } : null}
              />
              <OperationalMetric
                label="System cost, no user expected"
                value={spend.totalUsd > 0 ? usd(spend.systemUsd) : "Not measured"}
                detail={spend.totalUsd > 0 ? `${((spend.systemUsd / spend.totalUsd) * 100).toFixed(1)}% of the total. Briefings, public chat, admin tools, cron.` : "No spend rows to measure."}
              />
            </MetricRow>

            <AiUsageTable rows={report.rows} />

            <p className="text-xs text-slate-500">
              Source: ai_usage_events, ai_spend_events and ai_usage_limits, last {REPORT_LOOKBACK_DAYS} days, read{" "}
              {new Date(report.readAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: PLATFORM_TZ })}.
              {report.truncated ? " The row cap was reached, so older rows are left out." : ""}
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
