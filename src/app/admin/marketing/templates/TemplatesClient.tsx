"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarketingTemplate } from "@/lib/marketing/types";

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

  const statusColor = (s: string) => {
    if (s === "active") return { bg: "#EAF3DE", color: "#3B6D11" };
    if (s === "archived") return { bg: "#FCEBEB", color: "#A32D2D" };
    return { bg: "#F1EFE8", color: "#5F5E5A" };
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setEditing({ name: "", subject: "", html_body: "", status: "draft" })}
          style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
        >
          + New template
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div style={{ background: "var(--muted)", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 14 }}>
            {editing.id ? "Edit template" : "New template"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "name", label: "Template name", type: "text" },
              { key: "subject", label: "Subject line", type: "text" },
              { key: "preview_text", label: "Preview text", type: "text" },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={(editing as Record<string, string>)[f.key] ?? ""}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Status</label>
              <select
                value={editing.status ?? "draft"}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as MarketingTemplate["status"] })}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
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
              style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontFamily: "var(--font-mono)", resize: "vertical" }}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Plain text body (optional)</label>
            <textarea
              value={editing.text_body ?? ""}
              onChange={(e) => setEditing({ ...editing, text_body: e.target.value })}
              rows={4}
              style={{ width: "100%", fontSize: 12, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontFamily: "var(--font-mono)", resize: "vertical" }}
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", background: "#534AB7", color: "#EEEDFE", cursor: "pointer" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(null)}
              style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
            >
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
            style={{ background: "var(--background)", borderRadius: 12, padding: 24, maxWidth: 600, width: "90%", maxHeight: "80vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 500, marginBottom: 8 }}>Preview: {preview.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Subject: {preview.subject}</div>
            <div
              style={{ border: "0.5px solid var(--border)", borderRadius: 8, padding: 16 }}
              dangerouslySetInnerHTML={{ __html: preview.html_body }}
            />
            <button
              onClick={() => setPreview(null)}
              style={{ marginTop: 16, fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {templates.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", gridColumn: "span 2" }}>No templates yet. Create one above.</p>
        )}
        {templates.map((t) => {
          const sc = statusColor(t.status);
          return (
            <div
              key={t.id}
              style={{ background: "var(--background)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                  {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
                Subject: {t.subject}
              </div>
              <div
                style={{ background: "var(--muted)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--muted-foreground)", maxHeight: 80, overflow: "hidden" }}
                dangerouslySetInnerHTML={{ __html: t.html_body.slice(0, 200) + "…" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => setPreview(t)}
                  style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
                >
                  Preview
                </button>
                <button
                  onClick={() => setEditing(t)}
                  style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer" }}
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
