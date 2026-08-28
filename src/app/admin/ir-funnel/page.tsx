import { requireRole } from "@/lib/supabase/auth";
import { loadFunnelReport } from "@/lib/analytics/funnel-report";

export const dynamic = "force-dynamic";

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export default async function IrFunnelPage() {
  await requireRole(["admin", "analyst"]);
  const report = await loadFunnelReport(7);
  const max = Math.max(1, ...report.steps.map((s) => s.count));

  return (
    <div style={{ padding: "20px 24px", maxWidth: 820 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#0F6E56" }}>Operate · IR funnel</p>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "#0A1A40", margin: "6px 0 2px" }}>Input metrics — last {report.days} days</h1>
      <p style={{ fontSize: 12.5, color: "#5F5E5A", margin: "0 0 18px" }}>
        Counts per funnel step and step-to-step conversion. These are the metrics to review weekly — signups and revenue lag them.
      </p>

      <div style={{ border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px", gap: 8, padding: "9px 14px", background: "#F7F9FC", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "#5F5E5A" }}>
          <span>Step</span>
          <span style={{ textAlign: "right" }}>Count</span>
          <span style={{ textAlign: "right" }}>From prev</span>
        </div>
        {report.steps.map((s) => (
          <div key={s.event} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px", gap: 8, alignItems: "center", padding: "10px 14px", borderTop: "0.5px solid #eef1f5", fontSize: 13 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, color: "#0A1A40" }}>{s.label}</div>
              <div style={{ height: 4, marginTop: 5, borderRadius: 2, background: "#eef1f5" }}>
                <div style={{ height: 4, borderRadius: 2, background: "#2E78F5", width: `${Math.round((s.count / max) * 100)}%` }} />
              </div>
            </div>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#0A1A40" }}>{s.count.toLocaleString()}</span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: s.conversionFromPrev != null && s.conversionFromPrev < 0.2 ? "#A32D2D" : "#0F6E56" }}>{pct(s.conversionFromPrev)}</span>
          </div>
        ))}
      </div>

      {report.total === 0 ? (
        <p style={{ fontSize: 12.5, color: "#854F0B", background: "#FAEEDA", borderRadius: 8, padding: "10px 12px", marginTop: 14 }}>
          No events recorded yet in this window. Once the assessment and pricing pages get traffic, steps will populate here.
        </p>
      ) : null}
    </div>
  );
}
