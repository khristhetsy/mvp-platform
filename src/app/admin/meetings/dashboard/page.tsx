import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getMeetingOpsSummary } from "@/lib/meetings/summary";
import { loadBoard } from "@/lib/meetings/foundation";
import { MeetingsDashboardClient, type DashboardPayload } from "./MeetingsDashboardClient";

export const dynamic = "force-dynamic";

const READY = new Set(["ready", "presented"]);

export default async function MeetingsDashboardPage() {
  const profile = await requireRole(["admin", "analyst"]);
  const ops = await getMeetingOpsSummary();

  let agenda: DashboardPayload["agenda"] = [];
  let deptReadiness: DashboardPayload["deptReadiness"] = [];

  if (ops.nextMeeting) {
    const board = await loadBoard(ops.nextMeeting.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin: any = createServiceRoleClient();
    const { data: depts } = await admin.from("departments").select("id, name");
    const deptName = new Map(((depts ?? []) as Array<{ id: string; name: string }>).map((d) => [d.id, d.name]));

    agenda = board.sections.map((s) => ({
      label: s.title,
      dept: s.department_id ? (deptName.get(s.department_id) ?? null) : null,
      status: READY.has(board.entries[s.id]?.status ?? "") ? "ready" : (board.entries[s.id]?.content ? "draft" : "none"),
    }));

    const byDept = new Map<string, { ready: number; total: number }>();
    for (const s of board.sections) {
      if (!s.department_id) continue;
      const cur = byDept.get(s.department_id) ?? { ready: 0, total: 0 };
      cur.total += 1;
      if (READY.has(board.entries[s.id]?.status ?? "")) cur.ready += 1;
      byDept.set(s.department_id, cur);
    }
    deptReadiness = Array.from(byDept.entries()).map(([id, v]) => ({
      name: deptName.get(id) ?? "Department",
      pct: v.total > 0 ? Math.round((v.ready / v.total) * 100) : 0,
      status: v.total === 0 ? "none" : v.ready === v.total ? "ready" : v.ready === 0 ? "none" : "draft",
    }));
  }

  const payload: DashboardPayload = {
    next: ops.nextMeeting,
    openTasks: ops.openTasks,
    atRiskObjectives: ops.atRiskObjectives,
    upcomingEvents: ops.upcomingConferences,
    agenda,
    deptReadiness,
  };

  return (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/admin/meetings" style={{ fontSize: 12, color: "#1A6CE4", textDecoration: "none" }}>← Meetings</Link>
        <h1 style={{ fontSize: 21, fontWeight: 600, color: "#0A1A40", margin: "6px 0 0" }}>Team meeting dashboard</h1>
      </div>
      <MeetingsDashboardClient payload={payload} />
    </AppShell>
  );
}
