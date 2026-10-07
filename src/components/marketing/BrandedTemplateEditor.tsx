"use client";

/**
 * Branded template editor (pop-up). Opened from the email draft's template picker
 * ("New branded template") and from Edit on a branded template in Marketing ›
 * Templates. Pick a design, fill the content, see the live preview; saving puts
 * the template in the Templates library under the chosen department.
 */
import { useEffect, useState } from "react";
import { renderCopyHtml } from "@/lib/email/render-copy";
import { condenseControls, isShort, viewKey } from "@/lib/email/condense";
import type { CopyWithMaster } from "@/lib/email/masters-queries";
import type { PlaceholderSchema, TemplateSlot } from "@/lib/email/template-schema";
import { DEPARTMENTS } from "@/lib/marketing/department-grouping";

type Master = { id: string; name: string; description: string; compiled_html: string; placeholder_schema: PlaceholderSchema };
export type SavedBrandedTemplate = { id: string; name: string; subject: string; html_body: string; department: string | null };

const PREVIEW_WIDTHS = { desktop: 640, mobile: 390 } as const;
const VIEW_LABELS = { first_paragraph: ["Full", "First paragraph"], first_3: ["All", "First 3"], hide: ["Show", "Hide"] } as const;
const DEFAULT_MASTER = "Deal introduction";

const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const btn: React.CSSProperties = { fontSize: 12, padding: "6px 12px", borderRadius: 7, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)", whiteSpace: "nowrap" };
const label: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted-foreground)", margin: "10px 0 4px" };

export function BrandedTemplateEditor({ templateId, defaultDepartment, primaryLabel = "Save", onClose, onSaved }: {
  /** Edit this branded template; omit to create a new one. */
  templateId?: string;
  defaultDepartment?: string;
  primaryLabel?: string;
  onClose: () => void;
  onSaved: (t: SavedBrandedTemplate) => void;
}) {
  const [masters, setMasters] = useState<Master[]>([]);
  const [masterId, setMasterId] = useState("");
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [department, setDepartment] = useState<string>(defaultDepartment ?? "");
  const [savedId, setSavedId] = useState<string | undefined>(templateId);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [width, setWidth] = useState<keyof typeof PREVIEW_WIDTHS>("desktop");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/marketing/branded-templates");
        const j = (await r.json()) as { masters?: Master[]; defaults?: Record<string, string>; error?: string };
        if (!alive) return;
        if (!r.ok) { setMsg(j.error ?? "Couldn't load the designs."); return; }
        const list = j.masters ?? [];
        setMasters(list);
        setDefaults(j.defaults ?? {});
        if (templateId) {
          const e = await fetch(`/api/marketing/branded-templates/${templateId}`);
          const ej = (await e.json()) as { template?: { department: string | null }; copy?: { id: string; master_id: string; slot_values: Record<string, string> }; error?: string };
          if (!alive) return;
          if (!e.ok || !ej.copy) { setMsg(ej.error ?? "Couldn't open this template."); return; }
          setMasterId(ej.copy.master_id);
          setSlots(ej.copy.slot_values ?? {});
          setCopyId(ej.copy.id);
          setDepartment(ej.template?.department ?? "");
        } else {
          const first = list.find((m) => m.name === DEFAULT_MASTER) ?? list[0];
          if (first) setMasterId(first.id);
          setSlots({ ...(j.defaults ?? {}) });
        }
      } catch {
        if (alive) setMsg("Couldn't load the designs. Check your connection.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [templateId]);

  const master = masters.find((m) => m.id === masterId) ?? null;
  const schema = master?.placeholder_schema;
  const fields = (schema?.slots ?? []).filter((s) => s.key !== "banner_image");
  const controls = schema ? condenseControls(schema) : [];

  function buildPreview(): string {
    if (!master) return "";
    const copy = {
      id: copyId ?? "preview", master_id: master.id, name: "", slot_values: slots, banner_mode: "gradient",
      banner_image_url: null, footer_note: null, status: "draft", campaign_group_id: null, created_by: "", created_at: "", updated_at: "",
      master: { id: master.id, name: master.name, compiled_html: master.compiled_html, placeholder_schema: master.placeholder_schema },
    } as unknown as CopyWithMaster;
    return renderCopyHtml(copy, "preview");
  }
  const previewHtml = buildPreview();

  const set = (k: string, v: string) => setSlots((p) => ({ ...p, [k]: v }));

  function pickMaster(id: string) {
    if (templateId || id === masterId) return;
    setMasterId(id);
    setSlots({ ...defaults });
  }

  async function upload(slot: TemplateSlot, file: File) {
    setUploading(slot.key); setMsg(null);
    try {
      const body = new FormData(); body.append("file", file);
      const r = await fetch("/api/marketing/assets/upload", { method: "POST", body });
      const j = (await r.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!r.ok || !j?.url) { setMsg(j?.error ?? "Upload failed."); return; }
      set(slot.key, j.url);
    } catch { setMsg("Upload failed."); } finally { setUploading(null); }
  }

  /** Save (create or update). Returns the saved template, or null with a message. */
  async function save(): Promise<SavedBrandedTemplate | null> {
    if (!master || !schema) return null;
    const missing = schema.slots.filter((s) => s.required && !(slots[s.key] ?? "").trim()).map((s) => s.label);
    if (missing.length) { setMsg(`Fill in: ${missing.join(", ")}.`); return null; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(savedId ? `/api/marketing/branded-templates/${savedId}` : "/api/marketing/branded-templates", {
        method: savedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterId: master.id, slotValues: slots, department: department || null }),
      });
      const j = (await r.json().catch(() => null)) as (SavedBrandedTemplate & { error?: string; blocks?: { branded?: { copy_id?: string } } }) | null;
      if (!r.ok || !j?.id) { setMsg(j?.error ?? "Couldn't save. Try again."); return null; }
      setSavedId(j.id);
      if (j.blocks?.branded?.copy_id) setCopyId(j.blocks.branded.copy_id);
      return j;
    } catch { setMsg("Couldn't save. Check your connection."); return null; } finally { setBusy(false); }
  }

  async function primary() {
    const t = await save();
    if (t) onSaved(t);
  }

  async function sendTest() {
    const t = await save();
    if (!t) return;
    setMsg("Sending test…");
    try {
      const r = await fetch(`/api/marketing/branded-templates/${t.id}/test`, { method: "POST" });
      const j = (await r.json().catch(() => null)) as { to?: string; error?: string } | null;
      setMsg(r.ok ? `Test sent to ${j?.to ?? "you"}. Saved to Templates.` : j?.error ?? "Test send failed.");
    } catch { setMsg("Test send failed."); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={templateId ? "Edit branded template" : "New branded template"}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--background, #fff)", borderRadius: 12, width: "100%", maxWidth: 1180, height: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "0.5px solid var(--border)" }}>
        {/* Header: Save to, Send test, Cancel, primary */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "0.5px solid var(--border)" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{templateId ? "Edit branded template" : "New branded template"}</span>
          {msg ? <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 8 }}>{msg}</span> : null}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)" }}>Save to</span>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Save to department" style={{ ...inp, width: 170 }}>
            <option value="">Unassigned</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button type="button" onClick={() => void sendTest()} disabled={busy || loading} style={btn}>Send test</button>
          <button type="button" onClick={onClose} style={btn}>Cancel</button>
          <button type="button" onClick={() => void primary()} disabled={busy || loading}
            style={{ ...btn, border: "none", background: "#2E78F5", color: "#fff", fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Saving…" : primaryLabel}
          </button>
        </div>

        {/* Design (master) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderBottom: "0.5px solid var(--border)", fontSize: 12 }}>
          <span style={{ color: "var(--muted-foreground)" }}>Design:</span>
          {masters.map((m) => {
            const on = m.id === masterId;
            return (
              <button key={m.id} type="button" onClick={() => pickMaster(m.id)} disabled={!!templateId && !on} title={m.description}
                style={{ ...btn, padding: "5px 10px", border: on ? "2px solid #2E78F5" : "0.5px solid var(--border)", color: on ? "#185FA5" : "var(--foreground)", fontWeight: on ? 600 : 400, opacity: templateId && !on ? 0.45 : 1 }}>
                {m.name}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ padding: 24, fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</div>
        ) : (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", overflow: "hidden" }}>
            {/* Left: content fields from the design's schema */}
            <div style={{ overflowY: "auto", padding: "4px 16px 16px", borderRight: "0.5px solid var(--border)" }}>
              {fields.map((s) => (
                <div key={s.key}>
                  <label htmlFor={`bt-${s.key}`} style={label}>{s.label}{s.required ? <span style={{ color: "#A32D2D" }}> *</span> : null}</label>
                  {s.type === "textarea" || s.type === "richtext" || s.type === "list" || s.type === "terms" ? (
                    <textarea id={`bt-${s.key}`} value={slots[s.key] ?? ""} maxLength={s.max_length} onChange={(e) => set(s.key, e.target.value)}
                      rows={s.type === "richtext" ? 9 : s.type === "textarea" ? 3 : 6} style={{ ...inp, resize: "vertical" }} />
                  ) : s.type === "image" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input id={`bt-${s.key}`} value={slots[s.key] ?? ""} onChange={(e) => set(s.key, e.target.value)} placeholder="https://…" style={inp} />
                      <label style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {uploading === s.key ? "Uploading…" : <><i className="ti ti-upload" aria-hidden="true" /> Upload</>}
                        <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(s, f); e.target.value = ""; }} />
                      </label>
                    </div>
                  ) : (
                    <input id={`bt-${s.key}`} type={s.type === "url" ? "url" : "text"} value={slots[s.key] ?? ""} maxLength={s.max_length}
                      onChange={(e) => set(s.key, e.target.value)} style={inp} />
                  )}
                </div>
              ))}

              {controls.length > 0 && schema ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ ...label, marginTop: 0 }}>In the email</div>
                  {controls.map((s) => {
                    const short = isShort(schema, slots, s);
                    const [fullLabel, shortLabel] = VIEW_LABELS[s.condense!];
                    return (
                      <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0", fontSize: 12 }}>
                        <span style={{ flex: 1 }}>{s.condense_label ?? s.label}</span>
                        {(["full", "short"] as const).map((v) => {
                          const on = (v === "short") === short;
                          return (
                            <button key={v} type="button" onClick={() => set(viewKey(s.key), v)}
                              style={{ ...btn, padding: "3px 8px", fontSize: 11.5, background: on ? "#E6F1FB" : "transparent", color: on ? "#0C447C" : "var(--foreground)", borderColor: on ? "#B5D4F4" : "var(--border)" }}>
                              {v === "full" ? fullLabel : shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 14 }}>
                <i className="ti ti-lock" aria-hidden="true" /> Locked: logo, brand colors, disclaimer, address, unsubscribe
              </p>
            </div>

            {/* Right: live preview */}
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#eef2f8" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: "8px 14px" }}>
                {(["desktop", "mobile"] as const).map((w) => (
                  <button key={w} type="button" onClick={() => setWidth(w)}
                    style={{ ...btn, padding: "4px 10px", fontSize: 11.5, background: width === w ? "#fff" : "transparent", color: width === w ? "#185FA5" : "var(--muted-foreground)", fontWeight: width === w ? 600 : 400 }}>
                    <i className={`ti ti-device-${w}`} aria-hidden="true" /> {w === "desktop" ? "Desktop" : "Mobile"}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "0 14px 14px" }}>
                <iframe title="Email preview" srcDoc={previewHtml}
                  style={{ display: "block", margin: "0 auto", width: "100%", maxWidth: PREVIEW_WIDTHS[width], height: "100%", minHeight: 600, border: "0.5px solid #cbd5e1", borderRadius: 8, background: "#fff" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
