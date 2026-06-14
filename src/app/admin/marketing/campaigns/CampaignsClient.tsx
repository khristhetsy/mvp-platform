"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketingCampaign, MarketingList, MarketingTemplate } from "@/lib/marketing/types";

interface Props {
  campaigns: MarketingCampaign[];
  lists: MarketingList[];
  templates: MarketingTemplate[];
}

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "#F1EFE8", color: "#5F5E5A", label: "Draft" },
  scheduled: { bg: "#E6F1FB", color: "#185FA5", label: "Scheduled" },
  sending:   { bg: "#FAEEDA", color: "#854F0B", label: "Sending" },
  sent:      { bg: "#E1F5EE", color: "#0F6E56", label: "Sent" },
  paused:    { bg: "#FAEEDA", color: "#854F0B", label: "Paused" },
  cancelled: { bg: "#FCEBEB", color: "#A32D2D", label: "Cancelled" },
};

type CampaignDetail = {
  id: string; name: string; status: string; from_name: string; from_email: string;
  scheduled_at: string | null; sent_at: string | null;
  stat_sent: number; stat_delivered: number; stat_opened: number; stat_clicked: number; stat_bounced: number; stat_unsubscribed: number;
  breakdown: Array<{ event_type: string; count: number }>;
  events: Array<{ id: string; event_type: string; occurred_at: string; contact_email?: string; metadata: Record<string, unknown> }>;
};

export function CampaignsClient({ campaigns, lists, templates }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [analyticsId, setAnalyticsId] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<CampaignDetail | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [form, setForm] = useState({
    name: "",
    list_id: lists[0]?.id ?? "",
    template_id: templates[0]?.id ?? "",
    from_name: "CapitalOS",
    from_email: "outreach@mail.myicfos.com",
    reply_to: "",
    scheduled_at: "",
  });

  async function handleCreate(sendNow = false) {
    setSaving(true);
    try {
      const body: Record<string, string> = { ...form, status: "draft" };
      if (sendNow) body.action = "send";
      else if (form.scheduled_at) body.action = "schedule";
      await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowCreate(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to create campaign:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(campaignId: string, action: "send" | "pause" | "cancel" | "schedule", scheduledAt?: string) {
    setActing(campaignId + action);
    try {
      const body: Record<string, string> = { action, campaign_id: campaignId };
      if (scheduledAt) body.scheduled_at = scheduledAt;
      await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to perform campaign action:", err);
    } finally {
      setActing(null);
    }
  }

  async function openAnalytics(campaignId: string) {
    setAnalyticsId(campaignId);
    setLoadingAnalytics(true);
    setAnalyticsData(null);
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}`);
      if (res.ok) setAnalyticsData(await res.json());
    } catch (err) {
      console.error("Failed to load campaign analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  const rate = (num: number, denom: number) =>
    denom > 0 ? `${((num / denom) * 100).toFixed(1)}%` : "—";

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Campaigns</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{campaigns.length} total</div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New campaign
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: "#ffffff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: "18px 20px", marginBottom: 20, boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>New campaign</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "name",         label: "Campaign name",         type: "text" },
              { key: "from_name",    label: "From name",             type: "text" },
              { key: "from_email",   label: "From email",            type: "email" },
              { key: "reply_to",     label: "Reply-to (optional)",   type: "email" },
              { key: "scheduled_at", label: "Schedule send (optional)", type: "datetime-local" },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={(form as Record<string, string>)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Audience list</label>
              <select value={form.list_id} onChange={(e) => setForm({ ...form, list_id: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}>
                <option value="">— select list —</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Email template</label>
              <select value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}>
                <option value="">— select template —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          {form.scheduled_at && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#185FA5", padding: "6px 10px", background: "#E6F1FB", borderRadius: 6 }}>
              📅 Will be scheduled to send at {new Date(form.scheduled_at).toLocaleString()}
            </div>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => handleCreate(false)}
              disabled={saving || !form.name || !form.list_id || !form.template_id}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid #e2e6ed", background: "transparent", color: "var(--foreground)", cursor: "pointer", opacity: (!form.name || !form.list_id || !form.template_id) ? 0.5 : 1 }}>
              {saving ? "Saving…" : form.scheduled_at ? "Save as scheduled" : "Save as draft"}
            </button>
            {!form.scheduled_at && (
              <button onClick={() => handleCreate(true)}
                disabled={saving || !form.name || !form.list_id || !form.template_id}
                style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer", opacity: (!form.name || !form.list_id || !form.template_id) ? 0.5 : 1 }}>
                Send now
              </button>
            )}
            <button onClick={() => setShowCreate(false)}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Campaign cards */}
      {campaigns.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-foreground)", fontSize: 13 }}>
          No campaigns yet. Create your first one above.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {campaigns.map((c) => {
            const sc = STATUS_MAP[c.status] ?? STATUS_MAP.draft;
            const scheduledAt = (c as Record<string, unknown>).scheduled_at as string | null | undefined;
            return (
              <div key={c.id} style={{ background: "#ffffff", border: "0.5px solid #e2e6ed", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)" }}>
                {/* Card header */}
                <div style={{ padding: "14px 16px 12px", borderBottom: "0.5px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <button onClick={() => openAnalytics(c.id)}
                      style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.4, paddingRight: 8, background: "none", border: "none", cursor: "pointer", textAlign: "left", textDecoration: "none" }}>
                      {c.name}
                    </button>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {sc.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    {(c.list as { name?: string } | null)?.name ?? "No list"}
                  </div>
                  {scheduledAt && (
                    <div style={{ fontSize: 11, color: "#185FA5", marginTop: 3 }}>
                      📅 Scheduled: {new Date(scheduledAt).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Stats strip */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: "0.5px solid var(--border)" }}>
                  {[
                    { label: "Sent",      value: c.stat_sent.toLocaleString(),            color: "var(--foreground)" },
                    { label: "Opened",    value: rate(c.stat_opened, c.stat_sent),        color: "#534AB7" },
                    { label: "Clicked",   value: rate(c.stat_clicked, c.stat_sent),       color: "#1D9E75" },
                    { label: "Bounced",   value: rate(c.stat_bounced, c.stat_sent),       color: "#854F0B" },
                  ].map((stat, i) => (
                    <div key={stat.label} style={{ textAlign: "center", padding: "10px 0", borderLeft: i > 0 ? "0.5px solid var(--border)" : "none" }}>
                      <div style={{ fontSize: 16, fontWeight: 500, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ padding: "10px 16px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {c.status === "draft" && (
                    <button onClick={() => handleAction(c.id, "send")} disabled={acting === c.id + "send"}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}>
                      {acting === c.id + "send" ? "Sending…" : "Send now"}
                    </button>
                  )}
                  {c.status === "draft" && !scheduledAt && (
                    <ScheduleButton campaignId={c.id} onSchedule={(at) => handleAction(c.id, "schedule", at)} acting={acting === c.id + "schedule"} />
                  )}
                  {c.status === "sending" && (
                    <button onClick={() => handleAction(c.id, "pause")} disabled={acting === c.id + "pause"}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                      Pause
                    </button>
                  )}
                  {c.status === "paused" && (
                    <button onClick={() => handleAction(c.id, "send")} disabled={acting === c.id + "send"}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}>
                      Resume
                    </button>
                  )}
                  <button onClick={() => openAnalytics(c.id)}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                    ↗ Details
                  </button>
                  {["draft", "paused", "scheduled"].includes(c.status) && (
                    <button onClick={() => handleAction(c.id, "cancel")} disabled={acting === c.id + "cancel"}
                      style={{ marginLeft: "auto", fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Analytics drill-down drawer */}
      {analyticsId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setAnalyticsId(null)}>
          <div style={{ width: 520, height: "100%", background: "var(--card)", borderLeft: "1px solid var(--border)", overflowY: "auto", padding: 24 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Campaign analytics</h3>
              <button onClick={() => setAnalyticsId(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted-foreground)" }}>×</button>
            </div>

            {loadingAnalytics && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</div>}
            {analyticsData && <AnalyticsPanel data={analyticsData} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleButton({ campaignId, onSchedule, acting }: { campaignId: string; onSchedule: (at: string) => void; acting: boolean }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState("");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}>
        📅 Schedule
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)}
        style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
      <button onClick={() => { if (at) { onSchedule(at); setOpen(false); } }}
        disabled={!at || acting}
        style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "none", background: "#185FA5", color: "#fff", cursor: "pointer", opacity: (!at || acting) ? 0.5 : 1 }}>
        {acting ? "…" : "Set"}
      </button>
      <button onClick={() => setOpen(false)}
        style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}>
        ×
      </button>
    </div>
  );
}

function AnalyticsPanel({ data }: { data: CampaignDetail }) {
  const totalSent = data.stat_sent;
  const stats = [
    { label: "Sent",          value: data.stat_sent,          color: "var(--foreground)" },
    { label: "Delivered",     value: data.stat_delivered,     color: "#0F6E56" },
    { label: "Opened",        value: data.stat_opened,        color: "#534AB7" },
    { label: "Clicked",       value: data.stat_clicked,       color: "#1D9E75" },
    { label: "Bounced",       value: data.stat_bounced,       color: "#854F0B" },
    { label: "Unsubscribed",  value: data.stat_unsubscribed,  color: "#A32D2D" },
  ];

  const sc = { bg: "#E1F5EE", color: "#0F6E56", label: data.status };

  return (
    <>
      <div style={{ marginBottom: 16, padding: "12px 14px", background: "var(--muted)", borderRadius: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{data.name}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: sc.bg, color: sc.color }}>{data.status}</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{data.from_name} &lt;{data.from_email}&gt;</span>
        </div>
        {data.scheduled_at && (
          <div style={{ fontSize: 11, color: "#185FA5", marginTop: 4 }}>📅 Scheduled: {new Date(data.scheduled_at).toLocaleString()}</div>
        )}
        {data.sent_at && (
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>Sent: {new Date(data.sent_at).toLocaleString()}</div>
        )}
      </div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "var(--muted)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.value.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{s.label}</div>
            {totalSent > 0 && s.label !== "Sent" && (
              <div style={{ fontSize: 10, color: s.color, marginTop: 1 }}>
                {((s.value / totalSent) * 100).toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Funnel bar */}
      {totalSent > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: "var(--muted-foreground)" }}>FUNNEL</div>
          {[
            { label: "Delivered", value: data.stat_delivered, color: "#0F6E56" },
            { label: "Opened",    value: data.stat_opened,    color: "#534AB7" },
            { label: "Clicked",   value: data.stat_clicked,   color: "#1D9E75" },
          ].map((s) => (
            <div key={s.label} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 500 }}>{((s.value / totalSent) * 100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 6, background: "var(--muted)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (s.value / totalSent) * 100)}%`, background: s.color, borderRadius: 3, transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event timeline */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10, color: "var(--muted-foreground)" }}>
          RECENT EVENTS ({data.events.length})
        </div>
        {data.events.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No events yet.</div>
        ) : (
          data.events.slice(0, 50).map((ev) => {
            const ec: Record<string, { bg: string; color: string }> = {
              sent:       { bg: "#F1EFE8", color: "#5F5E5A" },
              delivered:  { bg: "#E1F5EE", color: "#0F6E56" },
              opened:     { bg: "#E6F1FB", color: "#185FA5" },
              clicked:    { bg: "#EEEDFE", color: "#534AB7" },
              bounced:    { bg: "#FAEEDA", color: "#854F0B" },
              unsubscribed: { bg: "#FCEBEB", color: "#A32D2D" },
              spam_complaint: { bg: "#FCEBEB", color: "#A32D2D" },
            };
            const badge = ec[ev.event_type] ?? { bg: "#F1EFE8", color: "#5F5E5A" };
            return (
              <div key={ev.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, paddingBottom: 8, borderBottom: "0.5px solid var(--border)" }}>
                <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 12, background: badge.bg, color: badge.color, fontWeight: 500, whiteSpace: "nowrap", marginTop: 1 }}>
                  {ev.event_type}
                </span>
                <div style={{ flex: 1 }}>
                  {ev.contact_email && <div style={{ fontSize: 12, color: "var(--foreground)" }}>{ev.contact_email}</div>}
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{new Date(ev.occurred_at).toLocaleString()}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
