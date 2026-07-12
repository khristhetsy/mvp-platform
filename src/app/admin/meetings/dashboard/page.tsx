import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { getMeetingOpsSummary } from "@/lib/meetings/summary";

export const dynamic = "force-dynamic";

const NAVY = "#0A1A40", BLUE = "#1A6CE4", MUTED = "var(--muted-foreground)";
const card: React.CSSProperties = { background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "14px 16px" };

export default async function MeetingsDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const ops = await getMeetingOpsSummary();

  const next = ops.nextMeeting;
  const readyPct = next && next.total > 0 ? Math.round((next.ready / next.total) * 100) : 0;
  const dateLabel = next ? new Date(`${next.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : null;

  const metrics: Array<{ label: string; value: string | number; sub?: string; tone?: string; href: string }> = [
    { label: "Open action items", value: ops.openTasks, sub: "not started or in progress", href: "/admin/meetings/plan", tone: ops.openTasks > 0 ? "#854F0B" : undefined },
    { label: "Plan objectives off track", value: ops.atRiskObjectives, sub: "at risk or off track", href: "/admin/meetings/plan", tone: ops.atRiskObjectives > 0 ? "#A32D2D" : undefined },
    { label: "Upcoming conferences", value: ops.upcomingConferences, sub: "scheduled ahead", href: "/admin/meetings/conferences" },
  ];

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/admin/meetings" style={{ fontSize: 12, color: BLUE, textDecoration: "none" }}>← Meetings</Link>
        <h1 style={{ fontSize: 21, fontWeight: 600, color: NAVY, margin: "6px 0 0" }}>Meetings dashboard</h1>
        <p style={{ fontSize: 12.5, color: MUTED, margin: "2px 0 0" }}>Readiness for your next team meeting, open items, and what needs attention.</p>
      </div>

      {/* Next meeting readiness */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>Next meeting
            {next && <span style={{ fontSize: 12, color: MUTED, fontWeight: 400 }}> · {next.name} · {dateLabel}</span>}
          </div>
          {next && <Link href={`/admin/meetings/${next.id}`} style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: "#E6F1FB", borderRadius: 8, padding: "6px 12px", textDecoration: "none" }}>Open board →</Link>}
        </div>
        {next ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 600, color: NAVY, fontVariantNumeric: "tabular-nums" }}>{next.ready} / {next.total}</span>
              <span style={{ fontSize: 12.5, color: MUTED }}>sections ready ({readyPct}%)</span>
            </div>
            <div style={{ height: 8, background: "#F1EFE8", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${readyPct}%`, background: readyPct >= 80 ? "#1D9E75" : readyPct >= 40 ? BLUE : "#EF9F27", borderRadius: 99 }} />
            </div>
          </>
        ) : (
          <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>No upcoming meeting scheduled. <Link href="/admin/meetings" style={{ color: BLUE, textDecoration: "none" }}>Create one →</Link></p>
        )}
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {metrics.map((m) => (
          <Link key={m.label} href={m.href} style={{ ...card, textDecoration: "none", display: "block" }}>
            <div style={{ fontSize: 12, color: MUTED }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: m.tone ?? NAVY, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{m.sub}</div>}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
