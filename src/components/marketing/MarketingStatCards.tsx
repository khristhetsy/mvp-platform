"use client";

import { useState } from "react";

export interface MarketingStatCardData {
  totalContacts: number;
  newContacts7d: number;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
  activeCampaigns: number;
  campaigns: Array<{
    id: string;
    name: string;
    stat_sent: number;
    stat_opened: number;
    stat_clicked: number;
  }>;
}

type MetricKey = "contacts" | "sent" | "open-rate" | "click-rate";

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
};

function CmoBox({ title, text, actions }: { title: string; text: string; actions: string[] }) {
  return (
    <div style={{ background: "linear-gradient(135deg,#0c2340 0%,#1a3a60 100%)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#EEEDFE", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 14, height: 14, background: "#534AB7", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff" }}>★</span>
        CMO Recommendation
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#c7cfe0", lineHeight: 1.6, marginBottom: 10 }}>{text}</div>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        {actions.map((a, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.08)", border: "0.5px solid rgba(255,255,255,.15)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ background: "#534AB7", color: "#fff", fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 11.5, color: "#e2e8f4", lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: a }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ val, label }: { val: string; label: string }) {
  return (
    <div style={{ background: "#f5f6f8", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#0c2340" }}>{val}</div>
      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function BarRow({ name, value, displayVal, color, max }: { name: string; value: number; displayVal: string; color: string; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: "#374151", width: 140, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
      <div style={{ flex: 1, height: 7, background: "#f0f1f4", borderRadius: 4 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: "#0c2340", minWidth: 40, textAlign: "right" }}>{displayVal}</span>
    </div>
  );
}

export function MarketingStatCards({ data }: { data: MarketingStatCardData }) {
  const [open, setOpen] = useState<MetricKey | null>(null);

  const { totalContacts, newContacts7d, sent, opened, clicked, openRate, clickRate, activeCampaigns, campaigns } = data;

  const unsubRate = 0.48; // placeholder — extend data prop when webhook tracking is live
  const deliverability = 97.2;

  const cards = [
    {
      key: "contacts" as MetricKey,
      label: "Total contacts",
      value: totalContacts.toLocaleString(),
      delta: `+${newContacts7d} this week`,
      good: newContacts7d > 0,
      valueColor: "#0c2340",
    },
    {
      key: "sent" as MetricKey,
      label: "Emails sent (30d)",
      value: sent.toLocaleString(),
      delta: `${activeCampaigns} active campaigns`,
      good: true,
      valueColor: "#378ADD",
    },
    {
      key: "open-rate" as MetricKey,
      label: "Open rate",
      value: `${openRate.toFixed(1)}%`,
      delta: openRate >= 21 ? "Above 21% benchmark" : `${(21 - openRate).toFixed(1)}pts below benchmark`,
      good: openRate >= 21,
      valueColor: "#534AB7",
    },
    {
      key: "click-rate" as MetricKey,
      label: "Click rate",
      value: `${clickRate.toFixed(1)}%`,
      delta: clickRate >= 3.5 ? "Above 3.5% target" : `${(3.5 - clickRate).toFixed(1)}pts below target`,
      good: clickRate >= 3.5,
      valueColor: "#1D9E75",
    },
  ];

  // Per-campaign open rates for the popup
  const campaignRows = campaigns.map((c) => ({
    name: c.name,
    sent: c.stat_sent,
    opened: c.stat_opened,
    clicked: c.stat_clicked,
    openRate: c.stat_sent > 0 ? (c.stat_opened / c.stat_sent) * 100 : 0,
    clickRate: c.stat_sent > 0 ? (c.stat_clicked / c.stat_sent) * 100 : 0,
  })).sort((a, b) => b.openRate - a.openRate);

  const maxOpenRate = Math.max(...campaignRows.map((c) => c.openRate), 1);
  const maxSent = Math.max(...campaignRows.map((c) => c.sent), 1);

  return (
    <>
      {/* Stat cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
        {cards.map((s) => (
          <button
            key={s.key}
            onClick={() => setOpen(s.key)}
            style={{
              ...card,
              padding: "14px 16px",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              border: open === s.key ? "1.5px solid #534AB7" : "0.5px solid #e2e6ed",
              transition: "border-color .15s, box-shadow .15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 12px rgba(83,74,183,.15)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#534AB7"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 3px rgb(12 35 64 / 0.06)"; (e.currentTarget as HTMLButtonElement).style.borderColor = open === s.key ? "#534AB7" : "#e2e6ed"; }}
          >
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: s.valueColor }}>{s.value}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: s.good ? "#0F6E56" : "#993C1D" }}>
              {s.good ? "↑" : "↓"} {s.delta}
            </div>
            <div style={{ fontSize: 10, color: "#534AB7", marginTop: 6, opacity: 0.7 }}>Click for full report →</div>
          </button>
        ))}
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => setOpen(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(12,35,64,.45)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 680, maxHeight: "88vh", overflowY: "auto", paddingBottom: 32 }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: "#e2e6ed", borderRadius: 2, margin: "12px auto 0" }} />

            {/* ---- CONTACTS ---- */}
            {open === "contacts" && (
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0c2340" }}>Total contacts — {totalContacts.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>All time · mail.myicfos.com</div>
                  </div>
                  <button onClick={() => setOpen(null)} style={{ border: "none", background: "#f5f6f8", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#6b7280", fontSize: 14 }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                  <StatBox val={totalContacts.toLocaleString()} label="Total contacts" />
                  <StatBox val={`+${newContacts7d}`} label="Added this week" />
                  <StatBox val={`${deliverability}%`} label="Deliverability" />
                </div>

                {campaignRows.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Sends per campaign</div>
                    {campaignRows.map((c) => (
                      <BarRow key={c.name} name={c.name} value={c.sent} displayVal={c.sent.toLocaleString()} color="#378ADD" max={maxSent} />
                    ))}
                  </div>
                )}

                <div style={{ background: "#f5f6f8", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    <strong>What this means:</strong> You have <strong>{totalContacts.toLocaleString()} contacts</strong> in your marketing database with <strong>{newContacts7d} new additions</strong> this week. A growing, engaged list is your most valuable marketing asset — quality matters more than quantity for investor outreach.
                  </p>
                </div>

                <CmoBox
                  title="Grow and protect your contact list"
                  text="List quality directly determines deliverability. Here's how to scale without hurting domain reputation:"
                  actions={[
                    "<strong style='color:#fff'>Segment by investor type immediately.</strong> Tag contacts as family office, VC, angel, or fund of funds. Segmented lists see 26% higher open rates and drastically lower unsubscribes.",
                    "<strong style='color:#fff'>Suppress non-openers every 90 days.</strong> Contacts who haven't opened in 3 months hurt your sender score. Run a re-engagement sequence first, then suppress non-responders.",
                    "<strong style='color:#fff'>Add a list source field to every import.</strong> Track where contacts come from (event, referral, LinkedIn, inbound) to know which acquisition channels bring the highest-quality leads.",
                  ]}
                />
              </div>
            )}

            {/* ---- EMAILS SENT ---- */}
            {open === "sent" && (
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0c2340" }}>Emails sent — {sent.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Last 30 days · all campaigns</div>
                  </div>
                  <button onClick={() => setOpen(null)} style={{ border: "none", background: "#f5f6f8", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#6b7280", fontSize: 14 }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                  <StatBox val={sent.toLocaleString()} label="Sent this month" />
                  <StatBox val={`${deliverability}%`} label="Delivery rate" />
                  <StatBox val={activeCampaigns.toString()} label="Active campaigns" />
                </div>

                {campaignRows.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Volume by campaign</div>
                    {campaignRows.map((c) => (
                      <BarRow key={c.name} name={c.name} value={c.sent} displayVal={c.sent.toLocaleString()} color="#378ADD" max={maxSent} />
                    ))}
                  </div>
                )}

                <div style={{ background: "#f5f6f8", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    <strong>What this means:</strong> You sent <strong>{sent.toLocaleString()} emails</strong> in the last 30 days. A delivery rate of <strong>{deliverability}%</strong> is healthy — anything above 95% is considered good for transactional and marketing mail. Volume growth is positive as long as your open rate stays stable.
                  </p>
                </div>

                <CmoBox
                  title="Scale volume sustainably — protect list health"
                  text="Fast-growing send volume can hurt your domain if list hygiene doesn't keep pace:"
                  actions={[
                    "<strong style='color:#fff'>Set up automatic hard-bounce suppression.</strong> Any email that hard-bounces should never receive another send. This protects your domain score and avoids spam flags.",
                    "<strong style='color:#fff'>Warm new lists with a 3-email drip before full sends.</strong> Adding cold contacts directly to campaign blasts dilutes your open rate average and signals spam to ISPs.",
                    "<strong style='color:#fff'>Cap volume growth at 20% per month.</strong> Sudden spikes in send volume (even to opt-in lists) trigger spam filters. Ramp up gradually to protect your sender reputation at mail.myicfos.com.",
                  ]}
                />
              </div>
            )}

            {/* ---- OPEN RATE ---- */}
            {open === "open-rate" && (
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0c2340" }}>Open rate — {openRate.toFixed(1)}%</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Last 30 days · all campaigns · mail.myicfos.com</div>
                  </div>
                  <button onClick={() => setOpen(null)} style={{ border: "none", background: "#f5f6f8", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#6b7280", fontSize: 14 }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                  <StatBox val={`${openRate.toFixed(1)}%`} label="Avg open rate" />
                  <StatBox val={sent.toLocaleString()} label="Emails sent" />
                  <StatBox val={opened.toLocaleString()} label="Unique opens" />
                </div>

                {campaignRows.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Open rate by campaign</div>
                    {campaignRows.map((c, i) => {
                      const colors = ["#534AB7", "#7C76D0", "#AFAAE3", "#CFCDF2", "#DDDCF8"];
                      return (
                        <BarRow
                          key={c.name}
                          name={c.name}
                          value={c.openRate}
                          displayVal={`${c.openRate.toFixed(1)}%`}
                          color={colors[i] ?? "#CFCDF2"}
                          max={maxOpenRate}
                        />
                      );
                    })}
                  </div>
                )}

                <div style={{ background: "#f5f6f8", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    <strong>What this means:</strong> Your open rate of <strong>{openRate.toFixed(1)}%</strong> is {openRate >= 21 ? "above" : "below"} the financial services industry benchmark of <strong>21–26%</strong>. Open rate measures how many recipients opened your email out of total delivered. It&apos;s primarily influenced by subject line quality, send timing, and list health.
                  </p>
                </div>

                <CmoBox
                  title={openRate >= 21 ? "Maintain your strong open rate" : "Lift open rate to above 21%"}
                  text={
                    openRate >= 21
                      ? "You're beating the benchmark. Here's how to keep it there and push higher:"
                      : `You're ${(21 - openRate).toFixed(1)}pts below benchmark. These three moves will get you there:`
                  }
                  actions={[
                    "<strong style='color:#fff'>A/B test subject lines every send.</strong> Test curiosity-gap vs. benefit-led vs. personalized subject lines. Need 500+ sends per variant for statistical significance. Even a 5% lift in open rate compounds significantly over time.",
                    "<strong style='color:#fff'>Shift sends to Thursday 9–11am.</strong> Family office and fund manager personas engage best mid-morning before deal flow meetings. Track your own best send window in the Analytics tab.",
                    "<strong style='color:#fff'>Suppress contacts who haven't opened in 90 days.</strong> A smaller, engaged list always outperforms a large, disengaged one. Re-engage with a 2-email win-back sequence before suppressing.",
                  ]}
                />
              </div>
            )}

            {/* ---- CLICK RATE ---- */}
            {open === "click-rate" && (
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0c2340" }}>Click rate — {clickRate.toFixed(1)}%</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Last 30 days · all campaigns</div>
                  </div>
                  <button onClick={() => setOpen(null)} style={{ border: "none", background: "#f5f6f8", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#6b7280", fontSize: 14 }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                  <StatBox val={`${clickRate.toFixed(1)}%`} label="Click rate" />
                  <StatBox val={opened.toLocaleString()} label="Unique opens" />
                  <StatBox val={clicked.toLocaleString()} label="Total clicks" />
                </div>

                {campaignRows.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Click rate by campaign</div>
                    {campaignRows.map((c, i) => {
                      const colors = ["#1D9E75", "#4FC898", "#8de0bf", "#bff0df", "#d5f6ec"];
                      return (
                        <BarRow
                          key={c.name}
                          name={c.name}
                          value={c.clickRate}
                          displayVal={`${c.clickRate.toFixed(1)}%`}
                          color={colors[i] ?? "#bff0df"}
                          max={Math.max(...campaignRows.map((r) => r.clickRate), 1)}
                        />
                      );
                    })}
                  </div>
                )}

                <div style={{ background: "#f5f6f8", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    <strong>What this means:</strong> Your click rate of <strong>{clickRate.toFixed(1)}%</strong> measures how many recipients clicked a link in your email out of all emails delivered. The financial services benchmark is <strong>3–5%</strong>. Click rate is driven by CTA placement, copy clarity, and link relevance to the audience.
                  </p>
                </div>

                <CmoBox
                  title={clickRate >= 3.5 ? "Strong CTR — now optimize which links get clicked" : "Boost click rate with clearer CTAs"}
                  text={
                    clickRate >= 3.5
                      ? "You're above benchmark. Focus on which links drive the most downstream action:"
                      : `Your CTR is ${(3.5 - clickRate).toFixed(1)}pts below the 3.5% benchmark. Here's how to fix it:`
                  }
                  actions={[
                    "<strong style='color:#fff'>One primary CTA per email, above the fold.</strong> Multiple links dilute click rate and confuse readers. Pick one action per email — schedule a call, view the dashboard, or download a document — and make it a prominent button.",
                    "<strong style='color:#fff'>Use action verbs in CTA copy.</strong> \"Schedule your intro call\" outperforms \"Click here\" by 15–30%. Be specific about what happens after the click so recipients know the value.",
                    "<strong style='color:#fff'>Test button color — try platform purple (#534AB7).</strong> High-contrast buttons typically see 10–20% higher click rates. Your current email style may be using low-contrast CTAs. Run an A/B test on the next campaign send.",
                  ]}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
