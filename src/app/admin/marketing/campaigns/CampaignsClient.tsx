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

export function CampaignsClient({ campaigns, lists, templates }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    list_id: lists[0]?.id ?? "",
    template_id: templates[0]?.id ?? "",
    from_name: "CapitalOS",
    from_email: "outreach@mail.myicfos.com",
    reply_to: "",
    scheduled_at: "",
  });

  async function handleCreate() {
    setSaving(true);
    await fetch("/api/marketing/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, status: "draft" }),
    });
    setSaving(false);
    setShowCreate(false);
    router.refresh();
  }

  async function handleAction(campaignId: string, action: "send" | "pause" | "cancel") {
    setActing(campaignId + action);
    await fetch("/api/marketing/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, campaign_id: campaignId }),
    });
    setActing(null);
    router.refresh();
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
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>New campaign</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "name",         label: "Campaign name",         type: "text" },
              { key: "from_name",    label: "From name",             type: "text" },
              { key: "from_email",   label: "From email",            type: "email" },
              { key: "reply_to",     label: "Reply-to (optional)",   type: "email" },
              { key: "scheduled_at", label: "Schedule (optional)",   type: "datetime-local" },
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
              <select
                value={form.list_id}
                onChange={(e) => setForm({ ...form, list_id: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
              >
                <option value="">— select list —</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Email template</label>
              <select
                value={form.template_id}
                onChange={(e) => setForm({ ...form, template_id: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
              >
                <option value="">— select template —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={saving || !form.name || !form.list_id || !form.template_id}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer", opacity: (!form.name || !form.list_id || !form.template_id) ? 0.5 : 1 }}
            >
              {saving ? "Creating…" : "Create campaign"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}
            >
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
            return (
              <div key={c.id} style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                {/* Card header */}
                <div style={{ padding: "14px 16px 12px", borderBottom: "0.5px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.4, paddingRight: 8 }}>{c.name}</div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {sc.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {(c.list as { name?: string } | null)?.name ?? "No list"}
                  </div>
                  {c.template && (
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
                      Template: {(c.template as { name?: string }).name}
                    </div>
                  )}
                </div>

                {/* Stats strip */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "0.5px solid var(--border)" }}>
                  {[
                    { label: "Sent",    value: c.stat_sent.toLocaleString(), color: "var(--foreground)" },
                    { label: "Opened",  value: rate(c.stat_opened, c.stat_sent), color: "#534AB7" },
                    { label: "Clicked", value: rate(c.stat_clicked, c.stat_sent), color: "#1D9E75" },
                  ].map((stat, i) => (
                    <div key={stat.label} style={{ textAlign: "center", padding: "10px 0", borderLeft: i > 0 ? "0.5px solid var(--border)" : "none" }}>
                      <div style={{ fontSize: 18, fontWeight: 500, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ padding: "10px 16px", display: "flex", gap: 6, alignItems: "center" }}>
                  {c.status === "draft" && (
                    <button
                      onClick={() => handleAction(c.id, "send")}
                      disabled={acting === c.id + "send"}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
                    >
                      {acting === c.id + "send" ? "Sending…" : "Send now"}
                    </button>
                  )}
                  {c.status === "sending" && (
                    <button
                      onClick={() => handleAction(c.id, "pause")}
                      disabled={acting === c.id + "pause"}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}
                    >
                      Pause
                    </button>
                  )}
                  {c.status === "paused" && (
                    <button
                      onClick={() => handleAction(c.id, "send")}
                      disabled={acting === c.id + "send"}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
                    >
                      Resume
                    </button>
                  )}
                  <button
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Duplicate
                  </button>
                  {["draft", "paused"].includes(c.status) && (
                    <button
                      onClick={() => handleAction(c.id, "cancel")}
                      disabled={acting === c.id + "cancel"}
                      style={{ marginLeft: "auto", fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
