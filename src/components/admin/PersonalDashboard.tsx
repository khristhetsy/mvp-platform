// Per-member "my activity" dashboard. Replaces the org-wide admin dashboard for every
// non-super-admin member: every number is scoped to the signed-in user's own records.
import Link from "next/link";
import type { PersonalDashboard as PersonalData } from "@/lib/dashboard/personal";

const NAVY = "#0A1A40", ACCENT = "#4338CA", MUTED = "var(--muted-foreground)";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function money(cents: number): string {
  if (cents >= 1000) return `$${Math.round(cents / 100000)}k`;
  return `$${Math.round(cents / 100).toLocaleString()}`;
}
function tint(a: number): string {
  const m = (c: number) => Math.round(c * a + 255 * (1 - a));
  return `rgb(${m(67)}, ${m(56)}, ${m(202)})`;
}
function when(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}
const KIND_ICON: Record<string, string> = {
  call: "ti-phone", email: "ti-mail", message: "ti-message", note: "ti-note",
  converted: "ti-arrow-right", stage_changed: "ti-arrow-right", won: "ti-trophy", lost: "ti-x",
  task_created: "ti-calendar-plus", task_done: "ti-check", contact_edit: "ti-edit", opp_note: "ti-note", email_draft: "ti-mail",
};
const TYPE_TONE: Record<string, { c: string; bg: string }> = {
  Call: { c: "#0F6E56", bg: "#E1F5EE" }, Email: { c: "#4338CA", bg: "#EEF2FF" }, Message: { c: "#854F0B", bg: "#FAEEDA" },
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "warn" }) {
  const warn = tone === "warn";
  return (
    <div style={{ background: warn ? "#FBF1DD" : "#fff", border: `0.5px solid ${warn ? "#EFDBB0" : "#e2e6ed"}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: warn ? "#854F0B" : MUTED }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: warn ? "#6E4109" : NAVY, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

export function PersonalDashboard({ name, data }: { name: string; data: PersonalData }) {
  const firstName = name.split(" ")[0] || name;
  const totalInFunnel = data.pipelineStages.reduce((a, s) => a + s.count, 0);
  const n = Math.max(1, data.pipelineStages.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".14em", color: MUTED }}>Your workspace</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: NAVY }}>{greeting()}, {firstName}</h1>
          <span style={{ fontSize: 12.5, color: MUTED }}>Showing only your activity</span>
        </div>
      </div>

      {/* My KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <Kpi label="My contacts" value={data.contactsCount.toLocaleString()} />
        <Kpi label="My open opportunities" value={data.openOppsCount} />
        <Kpi label="My pipeline value" value={money(data.pipelineCents)} />
        <Kpi label="Tasks due today" value={data.tasksDueToday} tone="warn" />
      </div>

      {/* My pipeline funnel */}
      {data.pipelineStages.length > 0 && (
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: NAVY, marginBottom: 16 }}>My pipeline
            <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 400 }}> · {totalInFunnel} in funnel</span>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: 11, left: `${(0.5 / n) * 100}%`, right: `${(0.5 / n) * 100}%`, height: 2, background: "var(--border)" }} />
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)` }}>
              {data.pipelineStages.map((s, i) => (
                <Link key={s.key} href={`/admin/sales/pipeline?stage=${s.key}`} style={{ position: "relative", zIndex: 1, textDecoration: "none", textAlign: "center" }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>{i + 1}</span>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: NAVY, marginTop: 7 }}>{s.count}</span>
                  <span style={{ display: "block", fontSize: 10.5, color: MUTED, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                  <span style={{ display: "block", fontSize: 10, color: tint(0.85), marginTop: 1 }}>{totalInFunnel > 0 ? Math.round((s.count / totalInFunnel) * 100) : 0}%</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* My tasks + my recent activity */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "11px 16px", borderBottom: "0.5px solid #eef1f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>My tasks</span>
            <Link href="/admin/sales/tasks" style={{ fontSize: 11.5, color: "#185FA5", textDecoration: "none" }}>View all</Link>
          </div>
          {data.tasks.length === 0 ? (
            <p style={{ padding: 16, fontSize: 12.5, color: MUTED }}>No open tasks. You&rsquo;re all caught up.</p>
          ) : data.tasks.map((t, i) => {
            const tone = TYPE_TONE[t.task_type] ?? { c: "#5F5E5A", bg: "#F1EFE8" };
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", fontSize: 12.5, borderTop: i ? "0.5px solid #eef1f5" : "none" }}>
                <span style={{ width: 14, height: 14, border: "1px solid var(--border-strong, #cbd5e1)", borderRadius: 4, flexShrink: 0 }} />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: tone.c, background: tone.bg, borderRadius: 10, padding: "2px 7px" }}>{t.task_type}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}{t.contact_name ? ` — ${t.contact_name}` : ""}</span>
                <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{t.due_date ? t.due_date.slice(0, 10) : "No date"}</span>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "11px 16px", borderBottom: "0.5px solid #eef1f5", fontSize: 13, fontWeight: 500, color: NAVY }}>My recent activity</div>
          {data.activity.length === 0 ? (
            <p style={{ padding: 16, fontSize: 12.5, color: MUTED }}>No activity logged yet.</p>
          ) : data.activity.map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", fontSize: 12.5, borderTop: i ? "0.5px solid #eef1f5" : "none" }}>
              <i className={`ti ${KIND_ICON[a.kind] ?? "ti-point"}`} style={{ color: MUTED, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.summary}</span>
              <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{when(a.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
