"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { MarketingTemplate } from "@/lib/marketing/types";
import { TemplateVisualEditor } from "@/components/marketing/TemplateVisualEditor";
import {
  defaultBlocks,
  renderBlocksToEmailHtml,
  renderBlocksToText,
  seedBlocksFromHtml,
  type TemplateBlock,
} from "@/lib/marketing/template-blocks";
import { DEFAULT_THEME, parseDocument, type TemplateTheme } from "@/lib/marketing/template-theme";

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
      <div style={{ borderBottom: "2px solid #2E78F5", paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#2E78F5", letterSpacing: "0.04em" }}>iCapOS</div>
        <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>outreach@icapos.com · icapos.com</div>
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
          <span style={{ color: "#2E78F5" }}>Unsubscribe</span>
        </div>
      </div>
    </div>
  );
}

/** Renders the actual template HTML full, exactly as it will appear in delivered mail —
 *  no synthetic letterhead/greeting scaffold and no cropping. */
function RawEmailPreview({ template }: { template: Partial<MarketingTemplate> }) {
  return (
    <div style={{ background: "#f4f7fc", borderRadius: 10, padding: 16, overflowX: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", width: 600, maxWidth: "100%", margin: "0 auto", border: "1px solid #E5E3DC", boxShadow: "0 2px 10px rgba(10,26,64,0.06)" }}>
        {template.subject && (
          <div style={{ padding: "10px 20px", borderBottom: "1px solid #eef2f9", fontSize: 12, color: "#5a6b8c" }}>
            Subject: <b style={{ color: "#13213f" }}>{template.subject}</b>
          </div>
        )}
        {template.html_body
          ? <div style={{ fontSize: 14, color: "#333", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: template.html_body }} />
          : <div style={{ padding: 24, color: "#B4B2A9", fontStyle: "italic" }}>No content yet.</div>}
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "#8fa0bf", marginTop: 10 }}>Full template as it renders in delivered mail — no cropping.</div>
    </div>
  );
}

type ViewMode = "grid" | "list";
type SortKey = "edited" | "name" | "status";

export function TemplatesClient({ templates }: { templates: MarketingTemplate[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<MarketingTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<MarketingTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<"visual" | "write" | "preview">("visual");
  // Structured blocks for the visual editor (regenerates html_body on save).
  const [blocks, setBlocks] = useState<TemplateBlock[] | null>(null);
  const [theme, setTheme] = useState<TemplateTheme>({ ...DEFAULT_THEME });
  // Which surface the user last edited. The visual editor regenerates html_body
  // from blocks, so if we always did that we'd silently discard hand-written
  // HTML. Whichever surface was touched last wins on save.
  const [editSource, setEditSource] = useState<"visual" | "html">("visual");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortKey>("edited");

  const sorted = [...templates].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "status") return a.status.localeCompare(b.status);
    return (b.updated_at ?? b.created_at ?? "").localeCompare(a.updated_at ?? a.created_at ?? "");
  });

  /** Open a template in the editor, seeding blocks so the Visual tab works. */
  function openEditor(t: Partial<MarketingTemplate>, tab: "visual" | "write" = "visual") {
    // `blocks` holds either a bare array (saved before themes existed) or a
    // versioned document; parseDocument normalises both.
    const doc = parseDocument((t as { blocks?: unknown }).blocks);
    setTheme(doc?.theme ?? { ...DEFAULT_THEME });
    setBlocks(
      doc && doc.blocks.length > 0
        ? doc.blocks
        : t.id
        ? seedBlocksFromHtml(t.subject ?? "", t.html_body ?? "")
        : defaultBlocks(),
    );
    setEditing(t);
    setActiveTab(tab);
    setEditSource(tab === "write" ? "html" : "visual");
  }

  /**
   * Duplicate a template: copies subject/body/blocks into a new DRAFT named
   * "Copy of …" (never inherits Active status), then opens it so it can be renamed.
   */
  async function handleDuplicate(t: MarketingTemplate) {
    setSaving(true);
    try {
      const res = await fetch("/api/marketing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Copy of ${t.name}`,
          subject: t.subject,
          preview_text: t.preview_text ?? "",
          html_body: t.html_body,
          text_body: t.text_body ?? "",
          blocks: t.blocks ?? null,
          status: "draft",
        }),
      });
      const created = (await res.json().catch(() => null)) as MarketingTemplate | null;
      setPreview(null);
      router.refresh();
      if (created?.id) openEditor(created, "visual");
    } catch (err) {
      console.error("Failed to duplicate template:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const isNew = !editing.id;
      const url = isNew ? "/api/marketing/templates" : `/api/marketing/templates/${editing.id}`;
      // If the user last edited raw HTML, save it verbatim and drop the stored
      // blocks — otherwise regenerating from stale blocks would wipe their edits.
      // Clearing blocks makes the Visual tab reseed from the new HTML next time.
      const payload =
        editSource === "html"
          ? { ...editing, blocks: null }
          : blocks
          ? {
              ...editing,
              blocks: { version: 2, theme, blocks },
              html_body: renderBlocksToEmailHtml(blocks, theme),
              text_body: renderBlocksToText(blocks),
            }
          : editing;
      let res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // The blocks column ships in migration 20260720002. If it hasn't been
      // applied yet, Postgres rejects the whole write and the template appears
      // not to save at all. Retry without blocks so the user's actual content is
      // never lost to a pending migration — the visual editor just reseeds from
      // html_body next time.
      if (!res.ok && (await res.clone().text()).toLowerCase().includes("blocks")) {
        const { blocks: _omit, ...withoutBlocks } = payload as Record<string, unknown>;
        void _omit;
        res = await fetch(url, {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withoutBlocks),
        });
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setSaveError(body?.error ?? `Save failed (${res.status}). Your changes are still here — nothing was lost.`);
        return;
      }

      setEditing(null);
      setBlocks(null);
      router.refresh();
    } catch (err) {
      console.error("Failed to save template:", err);
      setSaveError("Couldn't reach the server. Your changes are still here — try again.");
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", border: "0.5px solid #cdd9ec", borderRadius: 6, overflow: "hidden" }}>
            <button onClick={() => setView("list")} style={{ fontSize: 12, padding: "5px 10px", background: view === "list" ? "#2E78F5" : "transparent", color: view === "list" ? "#fff" : "var(--muted-foreground)", border: "none", cursor: "pointer" }}>☰ List</button>
            <button onClick={() => setView("grid")} style={{ fontSize: 12, padding: "5px 10px", background: view === "grid" ? "#2E78F5" : "transparent", color: view === "grid" ? "#fff" : "var(--muted-foreground)", border: "none", cursor: "pointer" }}>▦ Grid</button>
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ fontSize: 12, padding: "5px 9px", borderRadius: 6, border: "0.5px solid #cdd9ec", background: "#fff", color: "var(--foreground)" }}>
            <option value="edited">Recently edited</option>
            <option value="name">Name A–Z</option>
            <option value="status">Status</option>
          </select>
          <label style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "0.5px solid #C7D2E4", background: "#EEF3FC", color: "#185FA5", cursor: "pointer", fontWeight: 500 }}>
            ↑ Upload HTML
            <input
              type="file"
              accept=".html,.htm,text/html"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const text = await file.text();
                const name = file.name.replace(/\.html?$/i, "").replace(/[-_]+/g, " ").trim() || "Uploaded template";
                openEditor({ name, subject: "", preview_text: "", html_body: text, status: "draft" }, "write");
                setActiveTab("write");
              }}
            />
          </label>
          <button
            onClick={() => openEditor({ name: "", subject: "", html_body: "", status: "draft" }, "visual")}
            style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
            + New template
          </button>
        </div>
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
            {(["visual", "write", "preview"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: "7px 16px", fontSize: 12, fontWeight: activeTab === tab ? 500 : 400, color: activeTab === tab ? "#2E78F5" : "var(--muted-foreground)", background: "transparent", border: "none", borderBottom: activeTab === tab ? "2px solid #2E78F5" : "2px solid transparent", cursor: "pointer" }}>
                {tab === "visual" ? "🖼 Visual" : tab === "write" ? "</> HTML" : "Preview"}
              </button>
            ))}
          </div>

          {activeTab === "visual" ? (
            <div style={{ marginBottom: 12 }}>
              <TemplateVisualEditor
                blocks={blocks ?? []}
                onChange={(next) => { setBlocks(next); setEditSource("visual"); }}
                theme={theme}
                onThemeChange={(next) => { setTheme(next); setEditSource("visual"); }}
              />
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10 }}>
                Click any block to edit it. The email HTML is regenerated from these blocks when you save — it stays
                table-based and inline-styled so it renders correctly in Outlook and Gmail.
              </p>
            </div>
          ) : null}

          {activeTab === "write" ? (
            <>
              {editSource === "html" ? (
                <p style={{ fontSize: 11, color: "#8a6d1f", background: "#fdf6e3", border: "0.5px solid #f0e2b6", borderRadius: 6, padding: "7px 10px", marginBottom: 10 }}>
                  Editing raw HTML. Saving from here keeps your markup exactly as written — the Visual tab will rebuild
                  its blocks from it next time you open this template.
                </p>
              ) : null}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>
                  Email body — use {"{{first_name}}"}, {"{{company}}"} as variables
                </label>
                <textarea value={editing.html_body ?? ""}
                  onChange={(e) => { setEditing({ ...editing, html_body: e.target.value }); setEditSource("html"); }}
                  rows={12}
                  placeholder={"<p>Hi {{first_name}},</p>\n<p>I wanted to reach out about...</p>\n<p>Best regards,<br/>{{sender_name}}</p>"}
                  style={{ width: "100%", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontFamily: "var(--font-mono)", resize: "vertical", lineHeight: 1.7 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block", marginBottom: 4 }}>Plain text (optional)</label>
                <textarea value={editing.text_body ?? ""}
                  onChange={(e) => { setEditing({ ...editing, text_body: e.target.value }); setEditSource("html"); }}
                  rows={4}
                  style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontFamily: "var(--font-mono)", resize: "vertical" }} />
              </div>
            </>
          ) : null}

          {activeTab === "preview" ? (
            <div style={{ padding: "8px 0" }}>
              {/* Preview what will actually be stored: regenerated HTML when the
                  visual editor is the source, otherwise the raw HTML as typed. */}
              <RawEmailPreview
                template={
                  editSource === "visual" && blocks
                    ? { ...editing, html_body: renderBlocksToEmailHtml(blocks, theme) }
                    : editing
                }
              />
            </div>
          ) : null}

          {saveError ? (
            <p style={{ marginTop: 12, fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 6, padding: "8px 11px" }}>
              {saveError}
            </p>
          ) : null}

          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2E78F5", color: "#EEEDFE", cursor: "pointer" }}>
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
          <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto", scrollbarGutter: "stable" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{preview.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Letter preview</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {/* Edit from the preview: opens the visual editor on this template. */}
                <button onClick={() => { openEditor(preview, "visual"); setPreview(null); }}
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid #2E78F5", background: "#2E78F5", cursor: "pointer", color: "#ffffff", fontWeight: 600 }}>
                  Edit
                </button>
                <button onClick={() => void handleDuplicate(preview)} disabled={saving}
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid #bcd3fb", background: "#f2f7ff", cursor: "pointer", color: "#2E78F5", fontWeight: 600 }}>
                  ⧉ Duplicate
                </button>
                <button onClick={() => setPreview(null)}
                  style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
                  Close
                </button>
              </div>
            </div>
            <RawEmailPreview template={preview} />
          </div>
        </div>
      )}

      {/* Template cards */}
      {templates.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-foreground)", fontSize: 13 }}>
          No templates yet. Create your first one above.
        </div>
      ) : view === "list" ? (
        <div style={{ ...card, overflow: "hidden" }}>
          {sorted.map((t, i) => {
            const sc = STATUS_MAP[t.status] ?? STATUS_MAP.draft;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: i ? "0.5px solid var(--border)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--foreground)" }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.subject}</div>
                </div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500, whiteSpace: "nowrap" }}>{t.status.charAt(0).toUpperCase() + t.status.slice(1)}</span>
                <button onClick={() => setPreview(t)} style={{ fontSize: 12, padding: "4px 9px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}>Preview</button>
                <button onClick={() => openEditor(t, "visual")} style={{ fontSize: 12, padding: "4px 9px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}>Edit</button>
                <button onClick={() => void handleDuplicate(t)} disabled={saving} style={{ fontSize: 12, padding: "4px 9px", borderRadius: 6, border: "0.5px solid #bcd3fb", background: "#f2f7ff", cursor: "pointer", color: "#2E78F5", fontWeight: 600 }}>⧉ Duplicate</button>
                <button onClick={() => handleDelete(t.id)} style={{ fontSize: 12, padding: "4px 9px", borderRadius: 6, border: "0.5px solid #F09595", color: "#A32D2D", background: "transparent", cursor: "pointer" }}>Delete</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {sorted.map((t) => {
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
                  <button onClick={() => openEditor(t, "visual")}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)" }}>
                    Edit
                  </button>
                  <button onClick={() => void handleDuplicate(t)} disabled={saving}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #bcd3fb", background: "#f2f7ff", cursor: "pointer", color: "#2E78F5", fontWeight: 600 }}>
                    ⧉ Duplicate
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
