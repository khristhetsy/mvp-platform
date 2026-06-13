"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketingCampaign, MarketingList, MarketingTemplate } from "@/lib/marketing/types";

interface Props {
  campaigns: MarketingCampaign[];
  lists: MarketingList[];
  templates: MarketingTemplate[];
}

const statusColors: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#F1EFE8", color: "#5F5E5A" },
  scheduled: { bg: "#E6F1FB", color: "#185FA5" },
  sending: { bg: "#EEEDFE", color: "#3C3489" },
  sent: { bg: "#EAF3DE", color: "#3B6D11" },
  paused: { bg: "#FAEEDA", color: "#854F0B" },
  cancelled: { bg: "#FCEBEB", color: "#A32D2D" },
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

  const formatRate = (num: number, denom: number) =>
    denom > 0 ? `${((num / denom) * 100).toFixed(1)}%` : "—";

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
        >
          + New campaign
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: "var(--muted)", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 14 }}>New campaign</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "name", label: "Campaign name", type: "text" },
              { key: "from_name", label: "From name", type: "text" },
              { key: "from_email", label: "From email", type: "email" },
              { key: "reply_to", label: "Reply-to (optional)", type: "email" },
              { key: "scheduled_at", label: "Schedule send (optional)", type: "datetime-local" },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={(form as Record<string, string>)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Audience list</label>
              <select
                value={form.list_id}
                onChange={(e) => setForm({ ...form, list_id: e.target.value })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
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
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
              >
                <option value="">— select template —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={saving || !form.name || !form.list_id || !form.template_id}
              style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer", opacity: (!form.name || !form.list_id || !form.template_id) ? 0.5 : 1 }}
            >
              {saving ? "Creating…" : "Create campaign"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No campaigns yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {campaigns.map((c) => {
            const sc = statusColors[c.status] ?? statusColors.draft;
            return (
              <div
                key={c.id}
                style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {(c.list as { name?: string } | null)?.name ?? "No list"}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Sent</div><div style={{ fontSize: 16, fontWeight: 500 }}>{c.stat_sent.toLocaleString()}</div></div>
                  <div><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Opened</div><div style={{ fontSize: 16, fontWeight: 500 }}>{formatRate(c.stat_opened, c.stat_sent)}</div></div>
                  <div><div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Clicked</div><div style={{ fontSize: 16, fontWeight: 500 }}>{formatRate(c.stat_clicked, c.stat_sent)}</div></div>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 10 }}>
                  Template: {(c.template as { name?: string } | null)?.name ?? "—"}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {c.status === "draft" && (
                    <button
                      onClick={() => handleAction(c.id, "send")}
                      disabled={acting === c.id + "send"}
                      style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
                    >
                      {acting === c.id + "send" ? "Sending…" : "Send now"}
                    </button>
                  )}
                  {c.status === "sending" && (
                    <button
                      onClick={() => handleAction(c.id, "pause")}
                      disabled={acting === c.id + "pause"}
                      style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
                    >
                      Pause
                    </button>
                  )}
                  {c.status === "paused" && (
                    <button
                      onClick={() => handleAction(c.id, "send")}
                      disabled={acting === c.id + "send"}
                      style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
                    >
                      Resume
                    </button>
                  )}
                  {["draft", "paused"].includes(c.status) && (
                    <button
                      onClick={() => handleAction(c.id, "cancel")}
                      disabled={acting === c.id + "cancel"}
                      style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}
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
