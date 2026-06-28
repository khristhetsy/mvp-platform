"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { MarketingTemplate } from "@/lib/marketing/types";

const STATUS_MAP: Record<string, { bg: string; color: string }> = {
  active:   { bg: "#E1F5EE", color: "#0F6E56" },
  draft:    { bg: "#F1EFE8", color: "#5F5E5A" },
  archived: { bg: "#FCEBEB", color: "#A32D2D" },
};

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "0.5px solid #e2e6ed",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgb(12 35 64 / 0.06)",
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Render the email body as a letter-formatted document */
function LetterPreview({ template, compact = false }: { template: Partial<MarketingTemplate>; compact?: boolean }) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const bodyText = template.html_body ? stripHtml(template.html_body) : "";

  if (compact) {
    // Card preview — short snippet in letter style
    return (
      <div style={{ background: "#FAFAF9", border: "0.5px solid var(--border)", borderRadius: 8, padding: "14px 16px", fontFamily: "Georgia, serif" }}>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>{today}</div>
        <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 6 }}>Dear {"{{first_name}}"},</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
          {bodyText.slice(0, 180)}{bodyText.length > 180 ? "…" : ""}
        </div>
      </div>
    );
  }

  // Full letter preview
  return (
    <div style={{ background: "#fff", border: "0.5px solid #E5E3DC", borderRadius: 8, padding: "32px 40px", fontFamily: "Georgia, serif", maxWidth: 560, margin: "0 auto", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      {/* Letterhead */}
      <div style={{ borderBottom: "2px solid #534AB7", paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#534AB7", letterSpacing: "0.04em" }}>iCapOS</div>
        <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>outreach@mail.myicfos.com · icapos.com</div>
      </div>

      {/* Date */}
      <div style={{ fontSize: 13, color: "#5F5E5A", marginBottom: 20 }}>{today}</div>

      {/* Subject */}
      {template.subject && (
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: "#888780" }}>Re: </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{template.subject}</span>
        </div>
      )}

      {/* Greeting */}
      <div style={{ fontSize: 14, color: "#2C2C2A", marginBottom: 16 }}>Dear {"{{first_name}}"},</div>

      {/* Body */}
      <div style={{ fontSize: 14, color: "#444441", lineHeight: 1.8, marginBottom: 24 }}>
        {template.html_body ? (
          <div dangerouslySetInnerHTML={{ __html: template.html_body }} />
        ) : (
          <span style={{ color: "#B4B2A9", fontStyle: "italic" }}>Begin typing your message…</span>
        )}
      </div>

      {/* Closing */}
      <div style={{ fontSize: 14, color: "#2C2C2A", marginBottom: 8 }}>Sincerely,</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{"{{sender_name}}"}</div>
      <div style={{ fontSize: 12, color: "#888780" }}>iCapOS · icapos.com</div>

      {/* Footer rule */}
      <div style={{ borderTop: "0.5px solid #D3D1C7", marginTop: 28, paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: "#B4B2A9", textAlign: "center" }}>
          You&apos;re receiving this because you opted in at icapos.com ·{" "}
          <span style={{ color: "#534AB7" }}>Unsubscribe</span>
        </div>
      </div>
    </div>
  );
}

export function TemplatesClient({ templates }: { templates: MarketingTemplate[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<MarketingTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<MarketingTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const url = isNew ? "/api/marketing/templates" : `/api/marketing/templates/${editing.id}`;
      await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      setEditing(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to save template:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog({ message: "Delete this template?", danger: true, confirmLabel: "Delete" }))) return;
    try {
      await fetch(`/api/marketing/templates/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", marginBottom: 2 }}>Templates</h1>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{templates.length} total</div>
        </div>
        <button
          onClick={() => { setEditing({ name: "", subject: "", html_body: "", status: "draft" }); setActiveTab("write"); }}
          style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}>
          + New template
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div style={{ ...card, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>{editing.id ? "Edit template" : "New template"}</div>

          {/* Meta fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {[
              { key: "name",         label: "Template name" },
              { key: "subject",      label: "Subject line" },
              { key: "preview_text", label: "Preview text" },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type="text"
                  value={(editing as Record<string, string>)[f.key] ?? ""}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Status</label>
              <select value={editing.status ?? "draft"}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as MarketingTemplate["status"] })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Write / Preview tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--border)", marginBottom: 14 }}>
            {(["write", "preview"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: "7px 16px", fontSize: 12, fontWeight: activeTab === tab ? 500 : 400, color: activeTab === tab ? "#534AB7" : "var(--muted-foreground)", background: "transparent", border: "none", borderBottom: activeTab === tab ? "2px solid #534AB7" : "2px solid transparent", cursor: "pointer" }}>
                {tab === "write" ? "Write" : "Preview as letter"}
              </button>
            ))}
          </div>

          {activeTab === "write" ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>
                  Email body — use {"{{first_name}}"}, {"{{company}}"} as variables
                </label>
                <textarea value={editing.html_body ?? ""}
                  onChange={(e) => setEditing({ ...editing, html_body: e.target.value })}
                  rows={12}
                  placeholder={"<p>Hi {{first_name}},</p>\n<p>I wanted to reach out about...</p>\n<p>Best regards,<br/>{{sender_name}}</p>"}
                  style={{ width: "100%", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontFamily: "var(--font-mono)", resize: "vertical", lineHeight: 1.7 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Plain text (optional)</label>
                <textarea value={editing.text_body ?? ""}
                  onChange={(e) => setEditing({ ...editing, text_body: e.target.value })}
                  rows={4}
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontFamily: "var(--font-mono)", resize: "vertical" }} />
              </div>
            </>
          ) : (
            <div style={{ padding: "8px 0" }}>
              <LetterPreview template={editing} />
            </div>
          )}

          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}>
              {saving ? "Saving…" : "Save template"}
            </button>
            <button onClick={() => setEditing(null)}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Letter preview modal */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setPreview(null)}>
          <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, maxWidth: 660, width: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{preview.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Letter preview</div>
              </div>
              <button onClick={() => setPreview(null)}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                Close
              </button>
            </div>
            <LetterPreview template={preview} />
          </div>
        </div>
      )}

      {/* Template cards */}
      {templates.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-foreground)", fontSize: 13 }}>
          No templates yet. Create your first one above.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {templates.map((t) => {
            const sc = STATUS_MAP[t.status] ?? STATUS_MAP.draft;
            return (
              <div key={t.id} style={{ ...card, overflow: "hidden" }}>
                {/* Card header */}
                <div style={{ padding: "14px 16px 12px", borderBottom: "0.5px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", lineHeight: 1.4, paddingRight: 8 }}>{t.name}</div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{t.subject}</div>
                </div>

                {/* Letter-style body preview */}
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)" }}>
                  <LetterPreview template={t} compact />
                </div>

                {/* Actions */}
                <div style={{ padding: "10px 16px", display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => setPreview(t)}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}>
                    Preview
                  </button>
                  <button onClick={() => { setEditing(t); setActiveTab("write"); }}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(t.id)}
                    style={{ marginLeft: "auto", fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
