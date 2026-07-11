import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { listRecentSessions } from "@/lib/meetings/foundation";
import { NewSessionButton } from "./NewSessionButton";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const sessions = await listRecentSessions();

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 600, color: "#0A1A40", margin: "0 0 2px" }}>Meetings</h1>
          <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0 }}>Weekly management meeting — agenda, journals, and readiness.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/admin/meetings/conferences" style={{ fontSize: 12, fontWeight: 600, color: "#1A6CE4", background: "#E6F1FB", borderRadius: 8, padding: "7px 12px", textDecoration: "none" }}>Conferences</Link>
          <Link href="/admin/meetings/onboarding" style={{ fontSize: 12, fontWeight: 600, color: "#1A6CE4", background: "#E6F1FB", borderRadius: 8, padding: "7px 12px", textDecoration: "none" }}>Onboarding</Link>
          <Link href="/admin/meetings/campaigns" style={{ fontSize: 12, fontWeight: 600, color: "#1A6CE4", background: "#E6F1FB", borderRadius: 8, padding: "7px 12px", textDecoration: "none" }}>Campaigns</Link>
          <Link href="/admin/meetings/plan" style={{ fontSize: 12, fontWeight: 600, color: "#1A6CE4", background: "#E6F1FB", borderRadius: 8, padding: "7px 12px", textDecoration: "none" }}>Plan of Action</Link>
          <Link href="/admin/meetings/kpi" style={{ fontSize: 12, fontWeight: 600, color: "#1A6CE4", background: "#E6F1FB", borderRadius: 8, padding: "7px 12px", textDecoration: "none" }}>KPI Dashboard</Link>
          <NewSessionButton />
        </div>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr", padding: "9px 14px", background: "#F6F8FB", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted-foreground)" }}>
          <div>Meeting</div><div>Date</div><div>Status</div>
        </div>
        {sessions.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12.5, color: "var(--muted-foreground)" }}>No meeting sessions yet — create one to start prepping the agenda.</div>
        ) : sessions.map((s) => (
          <Link key={s.id} href={`/admin/meetings/${s.id}`} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr", padding: "10px 14px", borderTop: "0.5px solid #F1F4F9", alignItems: "center", textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0A1A40" }}>{s.meeting_name}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{new Date(`${s.session_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
            <div><span style={{ fontSize: 10.5, fontWeight: 600, background: s.started_at ? "#E1F5EE" : "#F1EFE8", color: s.started_at ? "#0F6E56" : "#5F5E5A", borderRadius: 6, padding: "2px 8px" }}>{s.started_at ? "Live" : "Scheduled"}</span></div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
