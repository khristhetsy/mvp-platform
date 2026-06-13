"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketingTemplate } from "@/lib/marketing/types";

const STATUS_MAP: Record<string, { bg: string; color: string }> = {
  active:   { bg: "#E1F5EE", color: "#0F6E56" },
  draft:    { bg: "#F1EFE8", color: "#5F5E5A" },
  archived: { bg: "#FCEBEB", color: "#A32D2D" },
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function TemplatesClient({ templates }: { templates: MarketingTemplate[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<MarketingTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<MarketingTemplate | null>(null);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const isNew = !editing.id;
    const url = isNew ? "/api/marketing/templates" : `/api/marketing/templates/${editing.id}`;
    await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    setEditing(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/marketing/templates/${id}`, { method: "DELETE" });
    router.refresh();
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
          onClick={() => setEditing({ name: "", subject: "", html_body: "", status: "draft" })}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New template
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>{editing.id ? "Edit template" : "New template"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "name",         label: "Template name" },
              { key: "subject",      label: "Subject line" },
              { key: "preview_text", label: "Preview text" },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input
                  type="text"
                  value={(editing as Record<string, string>)[f.key] ?? ""}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Status</label>
              <select
                value={editing.status ?? "draft"}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as MarketingTemplate["status"] })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>
              HTML body — use {`{{first_name}}`}, {`{{company}}`} as variables
            </label>
            <textarea
              value={editing.html_body ?? ""}
              onChange={(e) => setEditing({ ...editing, html_body: e.target.value })}
              rows={10}
              style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontFamily: "var(--font-mono)", resize: "vertical" }}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Plain text body (optional)</label>
            <textarea
              value={editing.text_body ?? ""}
              onChange={(e) => setEditing({ ...editing, text_body: e.target.value })}
              rows={4}
              style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontFamily: "var(--font-mono)", resize: "vertical" }}
            />
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}>
              {saving ? "Saving…" : "Save template"}
            </button>
            <button onClick={() => setEditing(null)} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setPreview(null)}
        >
          <div
            style={{ background: "var(--background)", borderRadius: 12, padding: 24, maxWidth: 620, width: "90%", maxHeight: "80vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{preview.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Subject: {preview.subject}</div>
              </div>
              <button onClick={() => setPreview(null)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                Close
              </button>
            </div>
            <div style={{ border: "0.5px solid var(--border)", borderRadius: 8, padding: 16 }} dangerouslySetInnerHTML={{ __html: preview.html_body }} />
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
            const snippet = stripHtml(t.html_body).slice(0, 160);
            return (
              <div key={t.id} style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
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

                {/* Body preview */}
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border)" }}>
                  <div style={{ background: "var(--muted)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                    {snippet}{snippet.length >= 160 ? "…" : ""}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ padding: "10px 16px", display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    onClick={() => setPreview(t)}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Preview
                  </button>
                  <button
                    onClick={() => setEditing(t)}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    style={{ marginLeft: "auto", fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}
                  >
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
