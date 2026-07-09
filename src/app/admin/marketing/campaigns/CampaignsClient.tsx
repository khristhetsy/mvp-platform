"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { MarketingCampaign, MarketingList, MarketingTemplate } from "@/lib/marketing/types";

interface Props {
  campaigns: MarketingCampaign[];
  lists: MarketingList[];
  templates: MarketingTemplate[];
  resendReady?: boolean;
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
  reply_to: string | null; list_id: string | null; template_id: string | null;
  subject_override: string | null; body_override: string | null;
  list_name: string | null; template_name: string | null; template_subject: string | null; template_html: string | null;
  scheduled_at: string | null; sent_at: string | null;
  stat_sent: number; stat_delivered: number; stat_opened: number; stat_clicked: number; stat_bounced: number; stat_unsubscribed: number;
  breakdown: Record<string, number>;
  events: Array<{ id: string; event_type: string; occurred_at: string; contact_email?: string; metadata: Record<string, unknown> }>;
};

const EDITABLE_STATUSES = ["draft", "scheduled", "paused"];
// ISO → value for <input type="datetime-local"> (local time, no seconds/zone).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignsClient({ campaigns, lists, templates, resendReady = true }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [sendingDue, setSendingDue] = useState(false);
  const [dueMsg, setDueMsg] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [healthMsg, setHealthMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [analyticsId, setAnalyticsId] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<CampaignDetail | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"analytics" | "preview">("analytics");
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", from_name: "", from_email: "", reply_to: "", list_id: "", template_id: "", scheduled_at: "" });
  const [form, setForm] = useState({
    name: "",
    list_id: lists[0]?.id ?? "",
    template_id: templates[0]?.id ?? "",
    from_name: "iCapOS",
    from_email: "outreach@icapos.com",
    reply_to: "admin@myicfos.com",
    scheduled_at: "",
  });

  // Deep-link from the Prospects wizard: ?new=<listId> opens the composer with
  // that list pre-filled as the audience (?new=1 just opens the composer).
  useEffect(() => {
    const nv = new URLSearchParams(window.location.search).get("new");
    if (!nv) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open composer from deep link on mount
    setShowCreate(true);
    if (nv !== "1" && lists.some((l) => l.id === nv)) setForm((f) => ({ ...f, list_id: nv }));
  }, [lists]);

  // Editable email preview for the campaign being composed.
  const selectedTemplate = templates.find((t) => t.id === form.template_id) ?? null;
  const [subjectDraft, setSubjectDraft] = useState("");
  const [previewSaved, setPreviewSaved] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Re-seed the preview whenever the picked template changes.
  useEffect(() => {
    if (!selectedTemplate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft to the newly picked template
    setSubjectDraft(selectedTemplate.subject ?? "");
    setPreviewSaved(false);
    if (bodyRef.current) bodyRef.current.innerHTML = selectedTemplate.html_body ?? "";
  }, [selectedTemplate?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function savePreview() {
    setPreviewSaved(true);
  }
  function undoPreview() {
    if (!selectedTemplate) return;
    setSubjectDraft(selectedTemplate.subject ?? "");
    if (bodyRef.current) bodyRef.current.innerHTML = selectedTemplate.html_body ?? "";
    setPreviewSaved(false);
  }

  async function handleCreate(sendNow = false) {
    setSaving(true);
    try {
      const body: Record<string, string> = { ...form, status: "draft" };
      // Convert the local datetime-picker value to an absolute UTC instant so the
      // scheduled send fires at the intended local time (not misread as UTC).
      if (form.scheduled_at) body.scheduled_at = new Date(form.scheduled_at).toISOString();
      // Attach per-campaign overrides only when the preview diverges from the template.
      if (selectedTemplate) {
        const bodyHtml = bodyRef.current?.innerHTML ?? "";
        body.subject_override = subjectDraft && subjectDraft !== selectedTemplate.subject ? subjectDraft : "";
        body.body_override = bodyHtml && bodyHtml !== selectedTemplate.html_body ? bodyHtml : "";
      }
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

  async function testEmailConnection() {
    setTesting(true); setHealthMsg(null);
    try {
      const res = await fetch("/api/marketing/email-health");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check failed.");
      const { shape, live } = data as {
        shape: { present: boolean; startsWithRe: boolean; cleanedLength: number; hadSurroundingQuotes: boolean; hadWhitespace: boolean; hadBearerPrefix: boolean };
        live: { ok: boolean; status: number | null; message: string };
      };
      let text: string;
      if (!shape.present) {
        text = "No RESEND_API_KEY is set in the environment. Add it in Vercel and redeploy.";
      } else if (!shape.startsWithRe) {
        text = `The stored value doesn't start with "re_" (length ${shape.cleanedLength}) — it isn't a Resend API key. Re-copy the key from Resend → API Keys.`;
      } else if (live.ok) {
        const artifacts = [shape.hadSurroundingQuotes && "quotes", shape.hadWhitespace && "whitespace", shape.hadBearerPrefix && "a Bearer prefix"].filter(Boolean);
        text = `Connected to Resend.${artifacts.length ? ` (Cleaned ${artifacts.join(" + ")} from the stored value — consider fixing it in Vercel.)` : ""}`;
      } else {
        text = `Resend rejected the key: ${live.message}${live.status ? ` (HTTP ${live.status})` : ""}. Generate a fresh key in Resend and re-paste it in Vercel (no quotes/spaces), then redeploy.`;
      }
      setHealthMsg({ ok: live.ok, text });
    } catch (err) {
      setHealthMsg({ ok: false, text: err instanceof Error ? err.message : "Check failed." });
    } finally { setTesting(false); }
  }

  async function sendDueNow() {
    setSendingDue(true); setDueMsg(null);
    try {
      const res = await fetch("/api/marketing/process-scheduled", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to process scheduled campaigns.");
      const n = data.processed ?? 0;
      setDueMsg(n > 0 ? `Sent ${n} due campaign${n === 1 ? "" : "s"}.` : "No campaigns are due right now.");
      router.refresh();
    } catch (err) {
      setDueMsg(err instanceof Error ? err.message : "Failed to process scheduled campaigns.");
    } finally { setSendingDue(false); }
  }

  const [showArchived, setShowArchived] = useState(false);
  async function setArchived(campaignId: string, archived: boolean) {
    setActing(campaignId + "archive");
    try {
      await fetch(`/api/marketing/campaigns/${campaignId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }),
      });
      router.refresh();
    } catch (err) {
      console.error("Failed to archive campaign:", err);
    } finally { setActing(null); }
  }

  async function handleSendTest(campaignId: string) {
    setTestingId(campaignId);
    setTestResult(null);
    try {
      const res = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", campaign_id: campaignId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) {
        setTestResult({ id: campaignId, ok: false, text: d.error || "Test send failed." });
        return;
      }
      setTestResult({ id: campaignId, ok: true, text: `Test sent to ${d.to}. Open it (and click the link) — opens/clicks appear here within a minute or two.` });
    } catch {
      setTestResult({ id: campaignId, ok: false, text: "Test send failed." });
    } finally {
      setTestingId(null);
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
    setEditing(false);
    setDrawerTab("analytics");
    setLoadingAnalytics(true);
    setAnalyticsData(null);
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaignId}`);
      if (res.ok) {
        // The detail endpoint nests the row under `campaign`; flatten it so the
        // panel's flat field reads (data.name, data.stat_*, …) resolve.
        const j = await res.json();
        const c = (j.campaign ?? j) as Record<string, unknown>;
        const tpl = (c.marketing_templates ?? {}) as Record<string, unknown>;
        const lst = (c.marketing_lists ?? {}) as Record<string, unknown>;
        const events = ((j.events ?? []) as Array<Record<string, unknown>>).map((e) => ({
          id: String(e.id), event_type: String(e.event_type), occurred_at: String(e.occurred_at),
          contact_email: (e.email as string) ?? undefined, metadata: (e.metadata as Record<string, unknown>) ?? {},
        }));
        setAnalyticsData({
          ...(c as unknown as CampaignDetail),
          list_name: (lst.name as string) ?? null,
          template_name: (tpl.name as string) ?? null,
          template_subject: (tpl.subject as string) ?? null,
          template_html: (tpl.html_body as string) ?? null,
          breakdown: (j.breakdown ?? {}) as Record<string, number>, events,
        });
      }
    } catch (err) {
      console.error("Failed to load campaign analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  function closeDrawer() { setAnalyticsId(null); setEditing(false); setExpanded(false); }

  function startEdit() {
    if (!analyticsData) return;
    setEditForm({
      name: analyticsData.name ?? "",
      from_name: analyticsData.from_name ?? "",
      from_email: analyticsData.from_email ?? "",
      reply_to: analyticsData.reply_to ?? "",
      list_id: analyticsData.list_id ?? "",
      template_id: analyticsData.template_id ?? "",
      scheduled_at: analyticsData.scheduled_at ? toLocalInput(analyticsData.scheduled_at) : "",
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!analyticsId) return;
    setSavingEdit(true);
    try {
      const body = {
        name: editForm.name.trim(),
        from_name: editForm.from_name.trim(),
        from_email: editForm.from_email.trim(),
        reply_to: editForm.reply_to.trim() || null,
        list_id: editForm.list_id || null,
        template_id: editForm.template_id || null,
        scheduled_at: editForm.scheduled_at ? new Date(editForm.scheduled_at).toISOString() : null,
      };
      const res = await fetch(`/api/marketing/campaigns/${analyticsId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditing(false);
      await openAnalytics(analyticsId);
      router.refresh();
    } catch (err) {
      console.error("Failed to save campaign:", err);
    } finally {
      setSavingEdit(false);
    }
  }

  const rate = (num: number | null | undefined, denom: number | null | undefined) =>
    denom && denom > 0 ? `${(((num ?? 0) / denom) * 100).toFixed(1)}%` : "—";
  const n = (v: number | null | undefined) => (v ?? 0);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Campaigns</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{campaigns.length} total</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={testEmailConnection} disabled={testing}
            title="Check whether the Resend email provider is connected"
            style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--border-strong, #cbd5e1)", background: "#fff", color: "var(--foreground)", cursor: "pointer", opacity: testing ? 0.5 : 1 }}>
            {testing ? "Testing…" : "Test email connection"}
          </button>
          <button onClick={sendDueNow} disabled={sendingDue}
            title="Send any scheduled campaigns whose time has passed"
            style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--border-strong, #cbd5e1)", background: "#fff", color: "var(--foreground)", cursor: "pointer", opacity: sendingDue ? 0.5 : 1 }}>
            {sendingDue ? "Sending…" : "Send due now"}
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New campaign
          </button>
        </div>
      </div>
      {dueMsg && (
        <div style={{ marginBottom: 16, fontSize: 12, color: "#1A4E9E", background: "#EFF6FF", border: "0.5px solid #BFDBFE", borderRadius: 8, padding: "8px 12px" }}>{dueMsg}</div>
      )}
      {healthMsg && (
        <div style={{ marginBottom: 16, fontSize: 12, color: healthMsg.ok ? "#065F46" : "#991B1B", background: healthMsg.ok ? "#ECFDF5" : "#FEF2F2", border: `0.5px solid ${healthMsg.ok ? "#A7F3D0" : "#FECACA"}`, borderRadius: 8, padding: "9px 12px" }}>
          {healthMsg.ok ? "✓ " : "⚠ "}{healthMsg.text}
        </div>
      )}
      {!resendReady && (
        <div style={{ marginBottom: 16, fontSize: 12, color: "#854F0B", background: "#FAEEDA", border: "0.5px solid #F0B65E", borderRadius: 8, padding: "9px 12px" }}>
          <b>Email provider not connected.</b> Campaigns won&rsquo;t deliver until <code>RESEND_API_KEY</code> is set in the environment and your sending domain (e.g. icapos.com) is verified in Resend. Sends are held rather than marked delivered.
        </div>
      )}

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
          {/* Editable email preview */}
          {selectedTemplate && (
            <div style={{ marginTop: 16, border: "0.5px solid #e2e6ed", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #e2e6ed", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--muted)" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Preview &amp; edit</span>
                <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 6, padding: "1px 7px" }}>Editing this campaign only</span>
                {previewSaved && <span style={{ fontSize: 10.5, color: "#0F6E56" }}>✓ Saved</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={undoPreview} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted-foreground)", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 6, padding: "5px 11px", cursor: "pointer" }}>↩ Undo</button>
                  <button onClick={savePreview} style={{ fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 6, padding: "5px 11px", cursor: "pointer" }}>Save changes</button>
                </div>
              </div>
              <div style={{ padding: "10px 14px", background: "#FAFBFC", borderBottom: "0.5px solid #e2e6ed", fontSize: 11.5, color: "var(--muted-foreground)", display: "flex", flexDirection: "column", gap: 3 }}>
                <div><span style={{ display: "inline-block", width: 42 }}>From</span> <span style={{ color: "var(--foreground)" }}>{form.from_name} &lt;{form.from_email}&gt;</span></div>
                <div><span style={{ display: "inline-block", width: 42 }}>To</span> <span style={{ color: "var(--foreground)" }}>{lists.find((l) => l.id === form.list_id)?.name ?? "— no list —"}</span></div>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)", marginBottom: 5 }}>Subject</label>
                <input value={subjectDraft} onChange={(e) => { setSubjectDraft(e.target.value); setPreviewSaved(false); }}
                  style={{ width: "100%", boxSizing: "border-box", fontSize: 13.5, fontWeight: 500, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }} />
                <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)", margin: "12px 0 5px" }}>Body <span style={{ textTransform: "none", fontWeight: 400 }}>· click to edit</span></label>
                <div ref={bodyRef} contentEditable suppressContentEditableWarning onInput={() => setPreviewSaved(false)}
                  style={{ border: "0.5px solid var(--border)", borderRadius: 8, padding: "12px 14px", fontSize: 13, lineHeight: 1.7, color: "var(--foreground)", minHeight: 140, outline: "none", background: "var(--background)" }} />
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 5, padding: "2px 7px" }}>{"{{first_name}}"}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 5, padding: "2px 7px" }}>{"{{company}}"}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 5, padding: "2px 7px" }}>unsubscribe link auto-added</span>
                </div>
              </div>
            </div>
          )}

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
                style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer", opacity: (!form.name || !form.list_id || !form.template_id) ? 0.5 : 1 }}>
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

      {/* Archived toggle */}
      {campaigns.some((c) => c.archived) && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button onClick={() => setShowArchived((v) => !v)}
            style={{ fontSize: 11.5, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            {showArchived ? "Hide archived" : `Show archived (${campaigns.filter((c) => c.archived).length})`}
          </button>
        </div>
      )}

      {/* Campaign cards */}
      {(() => { const visible = campaigns.filter((c) => showArchived || !c.archived); return visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-foreground)", fontSize: 13 }}>
          {campaigns.length === 0 ? "No campaigns yet. Create your first one above." : "No active campaigns. Toggle “Show archived” to see archived ones."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {visible.map((c) => {
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
                    { label: "Sent",      value: n(c.stat_sent).toLocaleString(),          color: "var(--foreground)" },
                    { label: "Opened",    value: rate(c.stat_opened, c.stat_sent),        color: "#2E78F5" },
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
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
                      {acting === c.id + "send" ? "Sending…" : "Send now"}
                    </button>
                  )}
                  {c.status === "draft" && !scheduledAt && (
                    <ScheduleButton onSchedule={(at) => handleAction(c.id, "schedule", at)} acting={acting === c.id + "schedule"} />
                  )}
                  {c.status === "sending" && (
                    <button onClick={() => handleAction(c.id, "pause")} disabled={acting === c.id + "pause"}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                      Pause
                    </button>
                  )}
                  {c.status === "paused" && (
                    <button onClick={() => handleAction(c.id, "send")} disabled={acting === c.id + "send"}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
                      Resume
                    </button>
                  )}
                  <button onClick={() => openAnalytics(c.id)}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                    ↗ Details
                  </button>
                  <button onClick={() => handleSendTest(c.id)} disabled={testingId === c.id || !resendReady}
                    title="Send one copy to your own email to validate delivery, opens, and clicks against a real inbox"
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: resendReady ? "pointer" : "not-allowed", color: "var(--muted-foreground)", opacity: resendReady ? 1 : 0.5 }}>
                    {testingId === c.id ? "Sending…" : "✉ Send test to me"}
                  </button>
                  <button onClick={() => setArchived(c.id, !c.archived)} disabled={acting === c.id + "archive"}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}>
                    {c.archived ? "Unarchive" : "Archive"}
                  </button>
                  {["draft", "paused", "scheduled"].includes(c.status) && (
                    <button onClick={() => handleAction(c.id, "cancel")} disabled={acting === c.id + "cancel"}
                      style={{ marginLeft: "auto", fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}>
                      Cancel
                    </button>
                  )}
                  {testResult?.id === c.id && (
                    <div style={{ flexBasis: "100%", fontSize: 11.5, marginTop: 2, color: testResult.ok ? "#0F6E56" : "#A32D2D" }}>
                      {testResult.text}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ); })()}

      {/* Analytics drill-down drawer — portalled to body so it isn't trapped by overflow ancestors */}
      {analyticsId && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
          onClick={closeDrawer}>
          <div style={{ width: expanded ? "min(1000px, 96vw)" : 520, height: "100%", background: "#fff", borderLeft: "0.5px solid #e2e6ed", boxShadow: "-8px 0 24px rgb(12 35 64 / 0.12)", overflowY: "auto", padding: 24, transition: "width 0.2s" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{editing ? "Edit campaign" : drawerTab === "preview" ? "Email preview" : "Campaign analytics"}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {analyticsData && !editing && EDITABLE_STATUSES.includes(analyticsData.status) && (
                  <button onClick={startEdit} style={{ fontSize: 12, fontWeight: 600, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 7, padding: "5px 11px", cursor: "pointer" }}>✎ Edit</button>
                )}
                <button onClick={() => setExpanded((v) => !v)} title={expanded ? "Collapse" : "Expand"}
                  style={{ fontSize: 12, color: "var(--muted-foreground)", background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>
                  {expanded ? "⤡ Collapse" : "⤢ Expand"}
                </button>
                <button onClick={closeDrawer} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted-foreground)", paddingLeft: 2 }}>×</button>
              </div>
            </div>

            {loadingAnalytics && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</div>}
            {analyticsData && !editing && (
              <div style={{ display: "inline-flex", border: "0.5px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                <button onClick={() => setDrawerTab("analytics")}
                  style={{ fontSize: 12, padding: "6px 14px", border: "none", background: drawerTab === "analytics" ? "#EFF6FF" : "#fff", color: drawerTab === "analytics" ? "#1A6CE4" : "var(--muted-foreground)", fontWeight: drawerTab === "analytics" ? 600 : 400, cursor: "pointer" }}>Analytics</button>
                <button onClick={() => setDrawerTab("preview")}
                  style={{ fontSize: 12, padding: "6px 14px", border: "none", borderLeft: "0.5px solid var(--border)", background: drawerTab === "preview" ? "#EFF6FF" : "#fff", color: drawerTab === "preview" ? "#1A6CE4" : "var(--muted-foreground)", fontWeight: drawerTab === "preview" ? 600 : 400, cursor: "pointer" }}>Preview</button>
              </div>
            )}
            {analyticsData && editing && (
              <CampaignEditForm form={editForm} setForm={setEditForm} lists={lists} templates={templates} saving={savingEdit} onSave={saveEdit} onCancel={() => setEditing(false)} />
            )}
            {analyticsData && !editing && drawerTab === "analytics" && <AnalyticsPanel data={analyticsData} />}
            {analyticsData && !editing && drawerTab === "preview" && <CampaignPreview data={analyticsData} />}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ScheduleButton({ onSchedule, acting }: { onSchedule: (at: string) => void; acting: boolean }) {
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

type EditForm = { name: string; from_name: string; from_email: string; reply_to: string; list_id: string; template_id: string; scheduled_at: string };

function CampaignEditForm({ form, setForm, lists, templates, saving, onSave, onCancel }: {
  form: EditForm; setForm: (f: EditForm) => void; lists: MarketingList[]; templates: MarketingTemplate[];
  saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 5 };
  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" };
  const set = (patch: Partial<EditForm>) => setForm({ ...form, ...patch });
  const canSave = form.name.trim().length > 0 && form.from_email.trim().length > 0 && !saving;
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={lbl}>Campaign name</label>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} style={inp} placeholder="Q3 investor outreach" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>From name</label><input value={form.from_name} onChange={(e) => set({ from_name: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>From email</label><input value={form.from_email} onChange={(e) => set({ from_email: e.target.value })} style={inp} /></div>
        </div>
        <div>
          <label style={lbl}>Reply-to</label>
          <input value={form.reply_to} onChange={(e) => set({ reply_to: e.target.value })} style={inp} placeholder="replies@icapos.com" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>Contact list</label>
            <select value={form.list_id} onChange={(e) => set({ list_id: e.target.value })} style={inp}>
              <option value="">— none —</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Template</label>
            <select value={form.template_id} onChange={(e) => set({ template_id: e.target.value })} style={inp}>
              <option value="">— none —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={lbl}>Scheduled send</label>
          <input type="datetime-local" value={form.scheduled_at} onChange={(e) => set({ scheduled_at: e.target.value })} style={inp} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 18, paddingTop: 16, borderTop: "0.5px solid var(--border)" }}>
        <button onClick={onSave} disabled={!canSave}
          style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#2E78F5", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", opacity: canSave ? 1 : 0.5 }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button onClick={onCancel} disabled={saving}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)", background: "#fff", border: "0.5px solid var(--border)", borderRadius: 8, padding: "9px 18px", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "12px 0 0" }}>Editing is available while a campaign is draft, scheduled, or paused. Sent campaigns are read-only.</p>
    </div>
  );
}

function CampaignPreview({ data }: { data: CampaignDetail }) {
  // Show the campaign's own edited content when present, else the template's.
  const subject = data.subject_override || data.template_subject || "(no subject)";
  const html = data.body_override || data.template_html || "";
  const meta: React.CSSProperties = { display: "inline-block", width: 54, color: "var(--muted-foreground)" };
  return (
    <div>
      <div style={{ border: "0.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "11px 14px", background: "var(--muted)", borderBottom: "0.5px solid var(--border)", fontSize: 11.5, color: "var(--muted-foreground)", display: "flex", flexDirection: "column", gap: 4 }}>
          <div><span style={meta}>From</span> <span style={{ color: "var(--foreground)" }}>{data.from_name} &lt;{data.from_email}&gt;</span></div>
          <div><span style={meta}>To</span> <span style={{ color: "var(--foreground)" }}>{data.list_name ?? "— no list —"}</span></div>
          {data.reply_to ? <div><span style={meta}>Reply-to</span> <span style={{ color: "var(--foreground)" }}>{data.reply_to}</span></div> : null}
          <div><span style={meta}>Subject</span> <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{subject}</span></div>
        </div>
        {html ? (
          <div style={{ padding: 16, fontSize: 13.5, lineHeight: 1.7, color: "var(--foreground)" }} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--muted-foreground)" }}>No template content to preview.</div>
        )}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {data.template_name ? <span style={{ fontSize: 10.5, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 5, padding: "2px 8px" }}>Template: {data.template_name}</span> : null}
        {data.body_override || data.subject_override ? <span style={{ fontSize: 10.5, color: "#185FA5", background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 5, padding: "2px 8px" }}>Edited for this campaign</span> : null}
        <span style={{ fontSize: 10.5, color: "#0F6E56", background: "#ECFDF5", border: "0.5px solid #A7F3D0", borderRadius: 5, padding: "2px 8px" }}>Merge fields fill per recipient · unsubscribe auto-added</span>
      </div>
    </div>
  );
}

function AnalyticsPanel({ data }: { data: CampaignDetail }) {
  const num = (v: number | null | undefined) => v ?? 0;
  const totalSent = num(data.stat_sent);
  const stats = [
    { label: "Sent",          value: num(data.stat_sent),          color: "var(--foreground)" },
    { label: "Delivered",     value: num(data.stat_delivered),     color: "#0F6E56" },
    { label: "Opened",        value: num(data.stat_opened),        color: "#2E78F5" },
    { label: "Clicked",       value: num(data.stat_clicked),       color: "#1D9E75" },
    { label: "Bounced",       value: num(data.stat_bounced),       color: "#854F0B" },
    { label: "Unsubscribed",  value: num(data.stat_unsubscribed),  color: "#A32D2D" },
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
            { label: "Opened",    value: data.stat_opened,    color: "#2E78F5" },
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
              clicked:    { bg: "#EEEDFE", color: "#2E78F5" },
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  {ev.contact_email && <div style={{ fontSize: 12, color: "var(--foreground)" }}>{ev.contact_email}</div>}
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{new Date(ev.occurred_at).toLocaleString()}</div>
                  {ev.metadata && typeof ev.metadata.error === "string" && ev.metadata.error ? (
                    <div style={{ fontSize: 11, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 6, padding: "4px 8px", marginTop: 4, wordBreak: "break-word" }}>{ev.metadata.error}</div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
