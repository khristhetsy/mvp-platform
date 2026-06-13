import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";

export const dynamic = "force-dynamic";

export default async function MarketingAnalyticsPage() {
  await requireRole(["admin"]);
  const supabase = await marketingDb();

  const since30d = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

  // 30-day funnel
  const eventTypes = ["sent", "delivered", "opened", "clicked", "replied", "bounced", "spam_complaint", "unsubscribed"];
  const funnelData: Record<string, number> = {};
  await Promise.all(
    eventTypes.map(async (et) => {
      const { count } = await supabase
        .from("marketing_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", et)
        .gte("occurred_at", since30d);
      funnelData[et] = count ?? 0;
    })
  );

  // Daily opens last 7 days
  const dailyOpens: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(Date.now() - i * 86400 * 1000);
    const end = new Date(Date.now() - (i - 1) * 86400 * 1000);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("marketing_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "opened")
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString());
    dailyOpens.push({
      date: start.toLocaleDateString("en-US", { weekday: "short" }),
      count: count ?? 0,
    });
  }

  const sent = funnelData["sent"] ?? 0;
  const delivered = funnelData["delivered"] ?? 0;
  const opened = funnelData["opened"] ?? 0;
  const clicked = funnelData["clicked"] ?? 0;
  const bounced = funnelData["bounced"] ?? 0;
  const spam = funnelData["spam_complaint"] ?? 0;

  const deliverability = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : "—";
  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "—";
  const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "—";
  const unsubRate = sent > 0 ? (((funnelData["unsubscribed"] ?? 0) / sent) * 100).toFixed(2) : "—";
  const spamRate = sent > 0 ? ((spam / sent) * 100).toFixed(3) : "—";
  const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(1) : "—";

  const maxDaily = Math.max(...dailyOpens.map((d) => d.count), 1);
  const funnelRows = [
    { label: "Sent", val: sent },
    { label: "Delivered", val: delivered },
    { label: "Opened", val: opened },
    { label: "Clicked", val: clicked },
    { label: "Replied", val: funnelData["replied"] ?? 0 },
  ];
  const maxFunnel = Math.max(sent, 1);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 20 }}>Analytics (last 30 days)</h1>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Deliverability", value: `${deliverability}%` },
          { label: "Open rate", value: `${openRate}%` },
          { label: "Click rate", value: `${clickRate}%` },
          { label: "Unsubscribes", value: `${unsubRate}%` },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--muted)", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Daily opens chart */}
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Opens by day (last 7 days)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
            {dailyOpens.map((d, i) => {
              const isToday = i === dailyOpens.length - 1;
              const height = Math.max((d.count / maxDaily) * 80, 4);
              return (
                <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{d.count}</div>
                  <div style={{
                    width: "100%",
                    height: height,
                    borderRadius: "3px 3px 0 0",
                    background: isToday ? "#534AB7" : "#EEEDFE",
                  }} />
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>{d.date}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Domain health */}
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Domain reputation</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 14 }}>mail.myicfos.com</div>
          {[
            { label: "Spam rate", value: spamRate + "%", pct: Math.min(parseFloat(spamRate) / 0.1, 1), good: parseFloat(spamRate) < 0.08 },
            { label: "Bounce rate", value: bounceRate + "%", pct: Math.min(parseFloat(bounceRate) / 5, 1), good: parseFloat(bounceRate) < 2 },
            { label: "Deliverability", value: deliverability + "%", pct: Math.min(parseFloat(deliverability) / 100, 1), good: parseFloat(deliverability) > 95 },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", width: 90 }}>{row.label}</div>
              <div style={{ flex: 1, height: 8, background: "var(--muted)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${row.pct * 100}%`, background: row.good ? "#1D9E75" : "#D85A30", borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, width: 44, textAlign: "right", color: row.good ? "#0F6E56" : "#993C1D" }}>
                {row.value}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: "8px 10px", background: "#EAF3DE", borderRadius: 8, fontSize: 12, color: "#3B6D11" }}>
            ✓ Domain health: good
          </div>
        </div>

        {/* Full funnel */}
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px", gridColumn: "span 2" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Full email funnel (30 days)</div>
          {funnelRows.map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", width: 80 }}>{f.label}</div>
              <div style={{ flex: 1, height: 10, background: "var(--muted)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(f.val / maxFunnel) * 100}%`, background: "#534AB7", borderRadius: 5 }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, width: 60, textAlign: "right" }}>
                {f.val.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", width: 48, textAlign: "right" }}>
                {sent > 0 ? `${((f.val / sent) * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
