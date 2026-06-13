"use client";

import { useState, useRef, useEffect } from "react";

interface Metrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  openRate: string;
  clickRate: string;
  deliverability: string;
  unsubRate: string;
  spamRate: string;
  bounceRate: string;
}

interface DailyOpen {
  date: string;
  count: number;
}

interface Props {
  metrics: Metrics;
  dailyOpens: DailyOpen[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BENCHMARKS = {
  openRate:      { label: "Open rate",      yours: 0, industry: 22,  unit: "%", higherBetter: true },
  clickRate:     { label: "Click rate",     yours: 0, industry: 3.5, unit: "%", higherBetter: true },
  deliverability:{ label: "Deliverability", yours: 0, industry: 95,  unit: "%", higherBetter: true },
  unsubRate:     { label: "Unsubscribe",    yours: 0, industry: 0.5, unit: "%", higherBetter: false },
};

const RECOMMENDATIONS = [
  {
    icon: "ti-mail-opened",
    color: "red" as const,
    priority: "High priority",
    priorityColor: "#A32D2D",
    priorityBg: "#FCEBEB",
    title: "A/B test subject lines to lift open rate",
    desc: "Open rate trails the 21–25% B2B fintech benchmark. Test 3 variants per send: curiosity-gap (\"What your deal flow is missing\"), benefit-led (\"Score any startup in under 5 min\"), and name-personalized. Need 500+ sends per variant for significance.",
  },
  {
    icon: "ti-cursor-text",
    color: "amber" as const,
    priority: "Medium",
    priorityColor: "#854F0B",
    priorityBg: "#FAEEDA",
    title: "Single CTA per email to lift click rate",
    desc: "Low click rate often means a diluted call to action. Each email should have one primary CTA above the fold with a strong action verb — \"See your investability score\" beats \"Learn more\". Remove all secondary links from the body.",
  },
  {
    icon: "ti-clock",
    color: "purple" as const,
    priority: "Quick win",
    priorityColor: "#3C3489",
    priorityBg: "#EEEDFE",
    title: "Schedule sends Tuesday 9–11am or Thursday 2–4pm",
    desc: "Family office and fund manager personas engage mid-morning before deal flow meetings, or early afternoon. Track open rate by send time across campaigns to validate and double down on your best window.",
  },
  {
    icon: "ti-users",
    color: "teal" as const,
    priority: "High impact",
    priorityColor: "#0F6E56",
    priorityBg: "#E1F5EE",
    title: "Segment by investor type for +26% open lift",
    desc: "Tag contacts as family office, VC, angel, or fund of funds and send tailored messaging. A family office CFO needs different framing than an angel investor. Add an investor_type field to your contact import CSV.",
  },
];

const QUICK_PROMPTS = [
  "What subject lines work best for cold family office outreach?",
  "How do I improve click-to-open rate for my campaigns?",
  "What email sequences should I build for warming up investors?",
];

const iconColorMap = {
  red:    { bg: "#FCEBEB", color: "#A32D2D" },
  amber:  { bg: "#FAEEDA", color: "#854F0B" },
  purple: { bg: "#EEEDFE", color: "#534AB7" },
  teal:   { bg: "#E1F5EE", color: "#0F6E56" },
};

export default function AnalyticsClient({ metrics, dailyOpens }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Your click rate is the biggest lever right now. With ${metrics.opened} opens but only ${metrics.clicked} clicks, your emails are being read — they're just not converting. The CTA is likely buried or generic. Ask me anything about your campaigns.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (msg: string) => {
    if (!msg.trim() || loading) return;
    const userMsg = msg.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/cmo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, metrics }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "No response." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const maxDaily = Math.max(...dailyOpens.map((d) => d.count), 1);

  const benchmarkRows = [
    { label: "Open rate",       yours: parseFloat(metrics.openRate),      industry: 22,  higherBetter: true },
    { label: "Click rate",      yours: parseFloat(metrics.clickRate),     industry: 3.5, higherBetter: true },
    { label: "Deliverability",  yours: parseFloat(metrics.deliverability),industry: 95,  higherBetter: true },
    { label: "Unsubscribe",     yours: parseFloat(metrics.unsubRate),     industry: 0.5, higherBetter: false },
  ];

  const funnelRows = [
    { label: "Sent",      val: metrics.sent },
    { label: "Delivered", val: metrics.delivered },
    { label: "Opened",    val: metrics.opened },
    { label: "Clicked",   val: metrics.clicked },
    { label: "Replied",   val: metrics.replied },
  ];
  const maxFunnel = Math.max(metrics.sent, 1);

  const statCards = [
    {
      label: "Deliverability",
      value: `${metrics.deliverability}%`,
      delta: parseFloat(metrics.deliverability) >= 95 ? "above" : "below",
      deltaLabel: parseFloat(metrics.deliverability) >= 95 ? "Above 95% benchmark" : "Below 95% benchmark",
      good: parseFloat(metrics.deliverability) >= 95,
    },
    {
      label: "Open rate",
      value: `${metrics.openRate}%`,
      delta: parseFloat(metrics.openRate) >= 21 ? "above" : "below",
      deltaLabel: parseFloat(metrics.openRate) >= 21 ? "Above 21% benchmark" : `${(22 - parseFloat(metrics.openRate)).toFixed(1)}pts below benchmark`,
      good: parseFloat(metrics.openRate) >= 21,
    },
    {
      label: "Click rate",
      value: `${metrics.clickRate}%`,
      delta: parseFloat(metrics.clickRate) >= 3.5 ? "above" : "below",
      deltaLabel: parseFloat(metrics.clickRate) >= 3.5 ? "Above 3.5% benchmark" : `${(3.5 - parseFloat(metrics.clickRate)).toFixed(1)}pts below target`,
      good: parseFloat(metrics.clickRate) >= 3.5,
    },
    {
      label: "Unsubscribes",
      value: `${metrics.unsubRate}%`,
      delta: parseFloat(metrics.unsubRate) <= 0.5 ? "good" : "high",
      deltaLabel: parseFloat(metrics.unsubRate) <= 0.5 ? "Healthy (< 0.5%)" : "Above 0.5% threshold",
      good: parseFloat(metrics.unsubRate) <= 0.5,
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Analytics</h1>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Last 30 days · mail.myicfos.com</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EEEDFE", border: "0.5px solid #AFA9EC", borderRadius: 10, padding: "6px 12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#534AB7" }} />
          <span style={{ fontSize: 12, color: "#3C3489", fontWeight: 500 }}>CMO assistant active</span>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{ background: "var(--muted)", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{s.value}</div>
            <div style={{ fontSize: 11, marginTop: 3, color: s.good ? "#0F6E56" : "#993C1D" }}>
              {s.good ? "↑" : "↓"} {s.deltaLabel}
            </div>
          </div>
        ))}
      </div>

      {/* Benchmarks + Funnel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

        {/* Benchmark panel */}
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 14 }}>
            vs. industry benchmarks (B2B fintech)
          </div>
          {benchmarkRows.map((row) => {
            const maxVal = Math.max(row.yours, row.industry) * 1.2;
            const yoursPct = Math.min((row.yours / maxVal) * 100, 100);
            const industryPct = (row.industry / maxVal) * 100;
            const isGood = row.higherBetter ? row.yours >= row.industry : row.yours <= row.industry;
            return (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: "0.5px solid var(--border)" }}>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", width: 100, flexShrink: 0 }}>{row.label}</div>
                <div style={{ flex: 1, height: 6, background: "var(--muted)", borderRadius: 3, position: "relative" }}>
                  <div style={{ height: 6, width: `${yoursPct}%`, background: isGood ? "#1D9E75" : "#E24B4A", borderRadius: 3 }} />
                  <div style={{ position: "absolute", top: -3, left: `${industryPct}%`, width: 2, height: 12, background: "var(--border)", borderRadius: 1 }} />
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", width: 90, textAlign: "right", flexShrink: 0 }}>
                  {row.yours.toFixed(1)}% / {row.industry}%
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 10, height: 2, background: "var(--border)" }} />
            Industry average marker
          </div>
        </div>

        {/* Funnel */}
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 14 }}>
            30-day email funnel
          </div>
          {funnelRows.map((f) => {
            const pct = (f.val / maxFunnel) * 100;
            return (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", width: 68, textAlign: "right", flexShrink: 0 }}>{f.label}</div>
                <div style={{ flex: 1, height: 26, background: "var(--muted)", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: "#CECBF6",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#3C3489",
                    minWidth: f.val > 0 ? 40 : 0,
                  }}>
                    {f.val > 0 ? f.val.toLocaleString() : ""}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", width: 44, textAlign: "right", flexShrink: 0 }}>
                  {metrics.sent > 0 ? `${((f.val / metrics.sent) * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily opens + Domain health */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

        {/* Daily opens */}
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Opens by day (last 7 days)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
            {dailyOpens.map((d, i) => {
              const isToday = i === dailyOpens.length - 1;
              const height = Math.max((d.count / maxDaily) * 80, 4);
              return (
                <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{d.count}</div>
                  <div style={{ width: "100%", height, borderRadius: "3px 3px 0 0", background: isToday ? "#534AB7" : "#EEEDFE" }} />
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
            { label: "Spam rate",     value: metrics.spamRate + "%",      pct: Math.min(parseFloat(metrics.spamRate) / 0.1, 1),          good: parseFloat(metrics.spamRate) < 0.08 },
            { label: "Bounce rate",   value: metrics.bounceRate + "%",    pct: Math.min(parseFloat(metrics.bounceRate) / 5, 1),           good: parseFloat(metrics.bounceRate) < 2 },
            { label: "Deliverability",value: metrics.deliverability + "%",pct: Math.min(parseFloat(metrics.deliverability) / 100, 1),    good: parseFloat(metrics.deliverability) > 95 },
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
      </div>

      {/* CMO Recommendations */}
      <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 14 }}>
          CMO recommendations
        </div>
        {RECOMMENDATIONS.map((rec, i) => {
          const { bg, color } = iconColorMap[rec.color];
          return (
            <div key={i} style={{ display: "flex", gap: 12, paddingBottom: i < RECOMMENDATIONS.length - 1 ? 14 : 0, marginBottom: i < RECOMMENDATIONS.length - 1 ? 14 : 0, borderBottom: i < RECOMMENDATIONS.length - 1 ? "0.5px solid var(--border)" : "none", alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color, fontSize: 16 }}>
                <i className={`ti ${rec.icon}`} aria-hidden="true" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  {rec.title}
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: rec.priorityBg, color: rec.priorityColor }}>
                    {rec.priority}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>{rec.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Virtual CMO Chat */}
      <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: "#fff", fontWeight: 500 }}>
            AI
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Virtual CMO</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Powered by Claude · CapitalOS Marketing</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-start" }}>
              {m.role === "assistant" && (
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, color: "#fff", fontWeight: 500, marginTop: 2 }}>
                  AI
                </div>
              )}
              <div style={{
                borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                background: m.role === "user" ? "#EEEDFE" : "var(--muted)",
                color: m.role === "user" ? "#26215C" : "var(--foreground)",
                padding: "10px 14px",
                fontSize: 13,
                lineHeight: 1.6,
                maxWidth: 520,
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 500 }}>AI</div>
              <div style={{ background: "var(--muted)", borderRadius: "12px 12px 12px 2px", padding: "10px 14px", fontSize: 13, color: "var(--muted-foreground)" }}>Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask your CMO anything..."
            style={{ flex: 1, padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{ padding: "8px 16px", fontSize: 13, borderRadius: 8, border: "none", background: "#534AB7", color: "#fff", cursor: "pointer", opacity: loading || !input.trim() ? 0.5 : 1 }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
