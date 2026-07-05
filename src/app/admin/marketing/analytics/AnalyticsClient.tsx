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

interface DailyOpen { date: string; count: number; }
interface CompletedCampaign { id: string; name: string; sent: number; opened: number; clicked: number; date: string; }
interface ListSummary { id: string; name: string; count: number; }
interface ListCampaign { id: string; name: string; list_id: string; sent: number; opened: number; clicked: number; }
interface Props { metrics: Metrics; dailyOpens: DailyOpen[]; completedCampaigns?: CompletedCampaign[]; lists?: ListSummary[]; listCampaigns?: ListCampaign[]; }
interface ChatMessage { role: "user" | "assistant"; content: string; }

const card = {
  background: "#ffffff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
} as React.CSSProperties;

const RECOMMENDATIONS = [
  {
    icon: "ti-mail-opened",
    color: { bg: "#FCEBEB", color: "#A32D2D" },
    priority: "High priority",
    priorityBg: "#FCEBEB",
    priorityColor: "#A32D2D",
    title: "A/B test subject lines to lift open rate",
    desc: "Open rate trails the 21–25% B2B fintech benchmark. Test 3 variants per send: curiosity-gap, benefit-led, and name-personalized. Need 500+ sends per variant for significance.",
  },
  {
    icon: "ti-cursor-text",
    color: { bg: "#FAEEDA", color: "#854F0B" },
    priority: "Medium",
    priorityBg: "#FAEEDA",
    priorityColor: "#854F0B",
    title: "Single CTA per email to lift click rate",
    desc: "Low click rate often means a diluted call to action. Each email should have one primary CTA above the fold with a strong action verb. Remove all secondary links from the body.",
  },
  {
    icon: "ti-clock",
    color: { bg: "#EEEDFE", color: "#2E78F5" },
    priority: "Quick win",
    priorityBg: "#EEEDFE",
    priorityColor: "#1A6CE4",
    title: "Schedule sends Tuesday 9–11am or Thursday 2–4pm",
    desc: "Family office and fund manager personas engage mid-morning before deal flow meetings, or early afternoon. Track open rate by send time to validate your best window.",
  },
  {
    icon: "ti-users",
    color: { bg: "#E1F5EE", color: "#0F6E56" },
    priority: "High impact",
    priorityBg: "#E1F5EE",
    priorityColor: "#085041",
    title: "Segment by investor type for +26% open lift",
    desc: "Tag contacts as family office, VC, angel, or fund of funds and send tailored messaging. Add an investor_type field to your contact import CSV.",
  },
];

const QUICK_PROMPTS = [
  "What subject lines work best for cold family office outreach?",
  "How do I improve click-to-open rate?",
  "What email sequences should I build for warming up investors?",
];

export default function AnalyticsClient({ metrics, dailyOpens, completedCampaigns = [], lists = [], listCampaigns = [] }: Props) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(completedCampaigns[0]?.id ?? "");
  const selectedCampaign = completedCampaigns.find((c) => c.id === selectedCampaignId) ?? null;

  const [selectedListId, setSelectedListId] = useState<string>(lists[0]?.id ?? "");
  const selectedList = lists.find((l) => l.id === selectedListId) ?? null;
  const listCamps = listCampaigns.filter((c) => c.list_id === selectedListId);
  const listSent = listCamps.reduce((a, c) => a + c.sent, 0);
  const listOpened = listCamps.reduce((a, c) => a + c.opened, 0);
  const listClicked = listCamps.reduce((a, c) => a + c.clicked, 0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Your click rate is the biggest lever right now. With ${metrics.opened} opens but only ${metrics.clicked} clicks, your emails are being read — they're just not converting. Ask me anything about your campaigns.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
    } finally { setLoading(false); }
  };

  const maxDaily = Math.max(...dailyOpens.map((d) => d.count), 1);

  const statCards = [
    { label: "Deliverability", value: `${metrics.deliverability}%`, delta: parseFloat(metrics.deliverability) >= 95 ? "Above 95% benchmark" : "Below 95% benchmark", good: parseFloat(metrics.deliverability) >= 95 },
    { label: "Open rate",      value: `${metrics.openRate}%`,      delta: parseFloat(metrics.openRate) >= 21 ? "Above 21% benchmark" : `${(22 - parseFloat(metrics.openRate)).toFixed(1)}pts below`, good: parseFloat(metrics.openRate) >= 21 },
    { label: "Click rate",     value: `${metrics.clickRate}%`,     delta: parseFloat(metrics.clickRate) >= 3.5 ? "Above 3.5% benchmark" : `${(3.5 - parseFloat(metrics.clickRate)).toFixed(1)}pts below`, good: parseFloat(metrics.clickRate) >= 3.5 },
    { label: "Unsubscribes",   value: `${metrics.unsubRate}%`,     delta: parseFloat(metrics.unsubRate) <= 0.5 ? "Healthy (< 0.5%)" : "Above 0.5% threshold", good: parseFloat(metrics.unsubRate) <= 0.5 },
  ];

  const benchmarkRows = [
    { label: "Open rate",      yours: parseFloat(metrics.openRate),       industry: 22,  higherBetter: true },
    { label: "Click rate",     yours: parseFloat(metrics.clickRate),      industry: 3.5, higherBetter: true },
    { label: "Deliverability", yours: parseFloat(metrics.deliverability), industry: 95,  higherBetter: true },
    { label: "Unsubscribe",    yours: parseFloat(metrics.unsubRate),      industry: 0.5, higherBetter: false },
  ];

  const funnelRows = [
    { label: "Sent",      val: metrics.sent },
    { label: "Delivered", val: metrics.delivered },
    { label: "Opened",    val: metrics.opened },
    { label: "Clicked",   val: metrics.clicked },
    { label: "Replied",   val: metrics.replied },
  ];
  const maxFunnel = Math.max(metrics.sent, 1);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, marginBottom: 2 }}>Analytics</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Last 30 days · icfocap.com</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EEEDFE", border: "0.5px solid #AFA9EC", borderRadius: 10, padding: "6px 12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2E78F5" }} />
          <span style={{ fontSize: 12, color: "#1A6CE4", fontWeight: 500 }}>CMO assistant active</span>
        </div>
      </div>

      {/* Campaign results — pick a completed campaign */}
      {completedCampaigns.length > 0 && (
        <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: selectedCampaign ? 12 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Campaign results</span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>completed campaign:</span>
            <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)}
              style={{ fontSize: 12, fontWeight: 600, border: "1px solid #2E78F5", background: "#EFF6FF", color: "#1A6CE4", borderRadius: 7, padding: "6px 10px" }}>
              {completedCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {selectedCampaign && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
              {[
                { label: "Sent", value: selectedCampaign.sent.toLocaleString(), color: "var(--foreground)" },
                { label: "Open rate", value: selectedCampaign.sent > 0 ? `${((selectedCampaign.opened / selectedCampaign.sent) * 100).toFixed(1)}%` : "—", color: "#0F6E56" },
                { label: "Click rate", value: selectedCampaign.sent > 0 ? `${((selectedCampaign.clicked / selectedCampaign.sent) * 100).toFixed(1)}%` : "—", color: "#0369A1" },
                { label: "Clicks", value: selectedCampaign.clicked.toLocaleString(), color: "var(--foreground)" },
              ].map((s) => (
                <div key={s.label} style={{ border: "0.5px solid var(--border)", borderRadius: 9, padding: "11px 13px", background: "var(--muted)" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* By contact list — pick a saved list to see how it performed */}
      {lists.length > 0 && (
        <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: selectedList ? 12 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>By contact list</span>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>saved list:</span>
            <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)}
              style={{ fontSize: 12, fontWeight: 600, border: "1px solid #2E78F5", background: "#EFF6FF", color: "#1A6CE4", borderRadius: 7, padding: "6px 10px" }}>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {selectedList && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
                {[
                  { label: "Contacts in list", value: selectedList.count.toLocaleString(), color: "var(--foreground)" },
                  { label: "Campaigns run", value: listCamps.length.toLocaleString(), color: "var(--foreground)" },
                  { label: "Avg open rate", value: listSent > 0 ? `${((listOpened / listSent) * 100).toFixed(1)}%` : "—", color: "#0F6E56" },
                  { label: "Avg click rate", value: listSent > 0 ? `${((listClicked / listSent) * 100).toFixed(1)}%` : "—", color: "#0369A1" },
                ].map((s) => (
                  <div key={s.label} style={{ border: "0.5px solid var(--border)", borderRadius: 9, padding: "11px 13px", background: "var(--muted)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {listCamps.length > 0 ? (
                <div style={{ marginTop: 12, border: "0.5px solid var(--border)", borderRadius: 9, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", padding: "7px 12px", background: "var(--muted)", fontSize: 10.5, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <div>Campaign</div><div style={{ textAlign: "right" }}>Sent</div><div style={{ textAlign: "right" }}>Open</div><div style={{ textAlign: "right" }}>Click</div>
                  </div>
                  {listCamps.map((c) => (
                    <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", padding: "8px 12px", borderTop: "0.5px solid var(--border)", fontSize: 12, alignItems: "center" }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                      <div style={{ textAlign: "right", color: "var(--muted-foreground)" }}>{c.sent.toLocaleString()}</div>
                      <div style={{ textAlign: "right", color: "#0F6E56" }}>{c.sent > 0 ? `${((c.opened / c.sent) * 100).toFixed(1)}%` : "—"}</div>
                      <div style={{ textAlign: "right", color: "#0369A1" }}>{c.sent > 0 ? `${((c.clicked / c.sent) * 100).toFixed(1)}%` : "—"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ marginTop: 12, fontSize: 12, color: "var(--muted-foreground)" }}>No campaigns have targeted this list yet.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Stat cards — white cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{ ...card, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{s.value}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: s.good ? "#0F6E56" : "#993C1D" }}>
              {s.good ? "↑" : "↓"} {s.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Benchmarks + Funnel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 14 }}>
            vs. industry benchmarks
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

        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 14 }}>
            30-day email funnel
          </div>
          {funnelRows.map((f) => {
            const pct = (f.val / maxFunnel) * 100;
            return (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", width: 68, textAlign: "right", flexShrink: 0 }}>{f.label}</div>
                <div style={{ flex: 1, height: 26, background: "var(--muted)", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#CECBF6", borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 12, fontWeight: 500, color: "#1A6CE4", minWidth: f.val > 0 ? 40 : 0 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Opens by day (last 7 days)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
            {dailyOpens.map((d, i) => {
              const isToday = i === dailyOpens.length - 1;
              const height = Math.max((d.count / maxDaily) * 80, 4);
              return (
                <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{d.count}</div>
                  <div style={{ width: "100%", height, borderRadius: "3px 3px 0 0", background: isToday ? "#2E78F5" : "#EEEDFE" }} />
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>{d.date}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Domain reputation</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 14 }}>icfocap.com</div>
          {[
            { label: "Spam rate",      value: metrics.spamRate + "%",       pct: Math.min(parseFloat(metrics.spamRate) / 0.1, 1),         good: parseFloat(metrics.spamRate) < 0.08 },
            { label: "Bounce rate",    value: metrics.bounceRate + "%",     pct: Math.min(parseFloat(metrics.bounceRate) / 5, 1),          good: parseFloat(metrics.bounceRate) < 2 },
            { label: "Deliverability", value: metrics.deliverability + "%", pct: Math.min(parseFloat(metrics.deliverability) / 100, 1),   good: parseFloat(metrics.deliverability) > 95 },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", width: 90 }}>{row.label}</div>
              <div style={{ flex: 1, height: 8, background: "var(--muted)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${row.pct * 100}%`, background: row.good ? "#1D9E75" : "#D85A30", borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, width: 44, textAlign: "right", color: row.good ? "#0F6E56" : "#993C1D" }}>{row.value}</div>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: "8px 10px", background: "#EAF3DE", borderRadius: 8, fontSize: 12, color: "#3B6D11" }}>
            ✓ Domain health: good
          </div>
        </div>
      </div>

      {/* CMO Recommendations */}
      <div style={{ ...card, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 14 }}>
          CMO recommendations
        </div>
        {RECOMMENDATIONS.map((rec, i) => (
          <div key={i} style={{ display: "flex", gap: 12, paddingBottom: i < RECOMMENDATIONS.length - 1 ? 14 : 0, marginBottom: i < RECOMMENDATIONS.length - 1 ? 14 : 0, borderBottom: i < RECOMMENDATIONS.length - 1 ? "0.5px solid var(--border)" : "none", alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: rec.color.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: rec.color.color, fontSize: 16 }}>
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
        ))}
      </div>

      {/* Virtual CMO Chat */}
      <div style={{ ...card, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2E78F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: "#fff", fontWeight: 500 }}>AI</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Virtual CMO</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Powered by Claude · iCapOS Marketing</div>
          </div>
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-start" }}>
              {m.role === "assistant" && (
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#2E78F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, color: "#fff", fontWeight: 500, marginTop: 2 }}>AI</div>
              )}
              <div style={{ borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: m.role === "user" ? "#EEEDFE" : "var(--muted)", color: m.role === "user" ? "#26215C" : "var(--foreground)", padding: "10px 14px", fontSize: 13, lineHeight: 1.6, maxWidth: 520 }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#2E78F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 500 }}>AI</div>
              <div style={{ background: "var(--muted)", borderRadius: "12px 12px 12px 2px", padding: "10px 14px", fontSize: 13, color: "var(--muted-foreground)" }}>Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {QUICK_PROMPTS.map((p) => (
            <button key={p} onClick={() => send(p)}
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>
              {p}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask your CMO anything..."
            style={{ flex: 1, padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
          <button onClick={() => send(input)} disabled={loading || !input.trim()}
            style={{ padding: "8px 16px", fontSize: 13, borderRadius: 8, border: "none", background: "#2E78F5", color: "#fff", cursor: "pointer", opacity: loading || !input.trim() ? 0.5 : 1 }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
