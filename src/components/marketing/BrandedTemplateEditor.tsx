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
import { ACCENT_SWATCHES, DESIGN_KEYS, dominantColor, hasDesign, mapFounderValues, readDesign, suggestLooks, writeDesign, type DesignSettings, type Look } from "@/lib/email/design";

type Master = { id: string; name: string; description: string; compiled_html: string; placeholder_schema: PlaceholderSchema };
type Prefill = { label: string; values: Record<string, string>; sources: Record<string, string>; website?: string | null };

/** Starting values for a design: saved defaults, then the founder's data mapped onto its fields. */
function startValues(masterName: string, defaults: Record<string, string>, prefill: Prefill | null): Record<string, string> {
  const mapped = prefill ? mapFounderValues(masterName, prefill.values, prefill.website) : {};
  const v: Record<string, string> = { ...defaults, ...mapped };
  if (!(v.cta_url ?? "").trim() && mapped.cta_url_fallback) v.cta_url = mapped.cta_url_fallback;
  delete v.cta_url_fallback;
  return v;
}

/** Which founder value fed each field of a design (keys of the founder prefill). */
const FOUNDER_FIELD: Record<string, Record<string, string>> = {
  Announcement: { headline: "headline", body: "body" },
  Newsletter: { headline: "headline", intro: "body", section_one_body: "considerations", section_two_body: "terms" },
  Promo: { headline: "headline", subhead: "body" },
};
export type SavedBrandedTemplate = { id: string; name: string; subject: string; html_body: string; department: string | null };

const PREVIEW_WIDTHS = { desktop: 640, mobile: 390 } as const;
const VIEW_LABELS = { first_paragraph: ["Full", "First paragraph"], first_3: ["All", "First 3"], hide: ["Show", "Hide"] } as const;
const DEFAULT_MASTER = "Deal introduction";

const inp: React.CSSProperties = { width: "100%", fontSize: 12.5, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box" };
const btn: React.CSSProperties = { fontSize: 12, padding: "6px 12px", borderRadius: 7, border: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)", whiteSpace: "nowrap" };
const label: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted-foreground)", margin: "10px 0 4px" };

export function BrandedTemplateEditor({ templateId, projectId, defaultDepartment, primaryLabel = "Save", onClose, onSaved }: {
  /** Edit this branded template; omit to create a new one. */
  templateId?: string;
  /** Investor Relations project: a new template is filled from its founder. */
  projectId?: string;
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
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const q = !templateId && projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
        const r = await fetch(`/api/marketing/branded-templates${q}`);
        const j = (await r.json()) as { masters?: Master[]; defaults?: Record<string, string>; prefill?: Prefill | null; error?: string };
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
          const pf = j.prefill && Object.keys(j.prefill.values).length ? j.prefill : null;
          setPrefill(pf);
          setSlots(startValues(first?.name ?? DEFAULT_MASTER, j.defaults ?? {}, pf));
        }
      } catch {
        if (alive) setMsg("Couldn't load the designs. Check your connection.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [templateId, projectId]);

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

  /** Where a prefilled field's value came from, for its tag. */
  function sourceFor(key: string): string | undefined {
    if (!prefill || !master) return undefined;
    if (key === "cta_url" && (slots.cta_url ?? "").trim()) {
      if (defaults.cta_url && slots.cta_url === defaults.cta_url) return "Your last booking link";
      if (prefill.website && slots.cta_url === prefill.website) return "Founder website";
      return undefined;
    }
    const from = master.name === "Deal introduction" ? key : FOUNDER_FIELD[master.name]?.[key];
    const src = from ? prefill.sources[from] : undefined;
    return src && (slots[key] ?? "").trim() ? src : undefined;
  }

  // The company's banner, for the suggested looks; its strongest color feeds "Company colors".
  const companyBanner = prefill?.values.hero_image ?? (master && hasDesign(schema) ? slots[DESIGN_KEYS.bannerImage] : "") ?? "";
  const [bannerColor, setBannerColor] = useState<string | null>(null);
  useEffect(() => {
    if (!companyBanner || typeof window === "undefined") return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 60; c.height = 18;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const color = dominantColor(ctx.getImageData(0, 0, c.width, c.height).data);
        if (alive) setBannerColor(color);
      } catch { /* image not readable: no company color */ }
    };
    img.src = companyBanner;
    return () => { alive = false; };
  }, [companyBanner]);

  function pickMaster(id: string) {
    if (templateId || id === masterId) return;
    setMasterId(id);
    setSlots(startValues(masters.find((m) => m.id === id)?.name ?? "", defaults, prefill));
  }

  async function upload(slot: Pick<TemplateSlot, "key">, file: File) {
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

        {prefill && !templateId ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#EAF3DE", color: "#27500A", fontSize: 12.5, borderBottom: "0.5px solid var(--border)" }}>
            <i className="ti ti-user-check" aria-hidden="true" />
            <span>Filled from the founder: <b>{prefill.label}</b></span>
            <button type="button" onClick={() => setSlots((p) => { const v = startValues(master?.name ?? "", {}, prefill); delete v.cta_url; return { ...p, ...v }; })} style={{ ...btn, marginLeft: "auto", background: "#fff", padding: "4px 10px" }}>
              <i className="ti ti-refresh" aria-hidden="true" /> Refill from founder
            </button>
          </div>
        ) : null}

        {loading ? (
          <div style={{ padding: 24, fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</div>
        ) : (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", overflow: "hidden" }}>
            {/* Left: content fields from the design's schema */}
            <div style={{ overflowY: "auto", padding: "4px 16px 16px", borderRight: "0.5px solid var(--border)" }}>
              {fields.map((s) => (
                <div key={s.key}>
                  <label htmlFor={`bt-${s.key}`} style={label}>
                    {s.label}{s.required ? <span style={{ color: "#A32D2D" }}> *</span> : null}
                    {prefill && !templateId ? <SourceTag source={sourceFor(s.key)} missing={s.key === "hero_image" && !(slots.hero_image ?? "").trim() ? "not in record: upload" : null} /> : null}
                  </label>
                  {prefill && !templateId && s.key === "terms" && master?.name === "Deal introduction" ? (
                    <div style={{ margin: "0 0 4px" }}><SourceTag source={undefined} missing="not in record: add interest, maturity, discount, warrants as lines" /></div>
                  ) : null}
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

              {master && hasDesign(schema) ? (
                <DesignPanel
                  masterName={master.name}
                  company={slots.company_name || prefill?.values.company_name || ""}
                  values={slots}
                  setValues={setSlots}
                  companyBanner={companyBanner}
                  bannerColor={bannerColor}
                  uploading={uploading}
                  onUpload={(key, f) => void upload({ key }, f)}
                />
              ) : null}

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
                <i className="ti ti-lock" aria-hidden="true" /> Locked: {hasDesign(schema) ? "disclaimer, address, unsubscribe" : "logo, brand colors, disclaimer, address, unsubscribe"}
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

/** Green tag naming where a prefilled value came from, or amber when the founder record has none. */
function SourceTag({ source, missing }: Readonly<{ source?: string; missing: string | null }>) {
  if (source) return <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 500, padding: "1px 6px", borderRadius: 6, background: "#EAF3DE", color: "#3B6D11" }}>{source}</span>;
  if (missing) return <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 500, padding: "1px 6px", borderRadius: 6, background: "#FAEEDA", color: "#854F0B" }}>{missing}</span>;
  return null;
}

const chip = (on: boolean): React.CSSProperties => ({
  fontSize: 11.5, padding: "4px 10px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap",
  border: on ? "2px solid #2E78F5" : "0.5px solid var(--border)", background: "transparent",
  color: on ? "#185FA5" : "var(--foreground)", fontWeight: on ? 600 : 400,
});

/** Small picture of a look: banner, logo, headline line, text lines and button. */
function LookThumb({ d, hasImage }: Readonly<{ d: DesignSettings; hasImage: boolean }>) {
  const dark = d.banner !== "none";
  const center = d.align === "center";
  const bar = (w: string, bg: string, h = 5) => <div style={{ width: w, height: h, borderRadius: 2, background: bg, margin: center ? "0 auto" : undefined }} />;
  return (
    <div style={{ borderRadius: 5, overflow: "hidden", border: "0.5px solid var(--border)", background: "#fff" }}>
      {d.banner === "image" && hasImage ? <div style={{ height: 16, background: "linear-gradient(90deg,#D9CCC3 50%,#F2EEEA 50%)" }} /> : null}
      <div style={{ background: dark ? "#0A1A40" : "#fff", padding: "5px 7px", borderBottom: dark ? "none" : "2px solid #0A1A40", display: "grid", gap: 5 }}>
        {bar("26%", d.logo === "icapos" ? (dark ? "#B5D4F4" : "#185FA5") : dark ? "#fff" : "#1A6CE4", 4)}
        {bar("62%", dark ? "#fff" : "#0A1A40")}
      </div>
      <div style={{ padding: "6px 7px 7px", display: "grid", gap: 4 }}>
        {bar("90%", "#D3D8E2", 4)}{bar("70%", "#D3D8E2", 4)}
        {bar("34%", d.accent, 7)}
      </div>
    </div>
  );
}

/** Design section: suggested looks, then banner, logo, accent color and alignment. */
function DesignPanel({ masterName, company, values, setValues, companyBanner, bannerColor, uploading, onUpload }: Readonly<{
  masterName: string; company: string; values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  companyBanner: string; bannerColor: string | null; uploading: string | null;
  onUpload: (key: string, file: File) => void;
}>) {
  const [page, setPage] = useState(0);
  const d = readDesign(values, masterName);
  const hasLogo = !!(values[DESIGN_KEYS.logoImage] ?? "").trim();
  const looks = suggestLooks({ company, hasBanner: !!companyBanner, hasLogo, bannerColor });
  const pages = Math.max(1, Math.ceil(looks.length / 4));
  const shown = looks.slice((page % pages) * 4, (page % pages) * 4 + 4);
  const same = (a: DesignSettings, b: DesignSettings) => a.banner === b.banner && a.logo === b.logo && a.accent.toLowerCase() === b.accent.toLowerCase() && a.align === b.align;
  const apply = (patch: Partial<DesignSettings>) => setValues((v) => writeDesign(v, patch));
  const pickLook = (l: Look) => setValues((v) => {
    const next = writeDesign(v, l.design);
    if (l.design.banner === "image" && companyBanner && !(next[DESIGN_KEYS.bannerImage] ?? "").trim()) next[DESIGN_KEYS.bannerImage] = companyBanner;
    return next;
  });
  const swatches = [...ACCENT_SWATCHES, ...(bannerColor && !ACCENT_SWATCHES.includes(bannerColor) ? [bannerColor] : [])];
  const sub: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--muted-foreground)", margin: "10px 0 4px" };
  const upBtn = (key: string) => (
    <label style={{ ...chip(false), display: "inline-flex", alignItems: "center", gap: 4 }}>
      {uploading === key ? "Uploading…" : <><i className="ti ti-upload" aria-hidden="true" /> Upload</>}
      <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(key, f); e.target.value = ""; }} />
    </label>
  );
  return (
    <div style={{ marginTop: 16, paddingTop: 10, borderTop: "0.5px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Design</span>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Suggested looks{company ? ` for ${company}` : ""}</span>
        {pages > 1 ? (
          <button type="button" onClick={() => setPage((p) => p + 1)} style={{ marginLeft: "auto", border: "none", background: "none", color: "#185FA5", fontSize: 11.5, cursor: "pointer" }}>
            <i className="ti ti-refresh" aria-hidden="true" /> More suggestions
          </button>
        ) : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginTop: 8 }}>
        {shown.map((l) => {
          const on = same(l.design, d);
          return (
            <button key={l.name} type="button" onClick={() => pickLook(l)} title={l.description}
              style={{ textAlign: "left", padding: 6, borderRadius: 8, cursor: "pointer", background: "var(--background)", border: on ? "2px solid #2E78F5" : "0.5px solid var(--border)" }}>
              <LookThumb d={l.design} hasImage={!!companyBanner} />
              <div style={{ fontSize: 11.5, fontWeight: 600, margin: "5px 2px 1px", color: "var(--foreground)" }}>{on ? <i className="ti ti-check" aria-hidden="true" style={{ color: "#185FA5" }} /> : null} {l.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "0 2px", lineHeight: 1.35 }}>{l.description}</div>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", margin: "6px 0 0" }}>Picking a look sets the controls below. Change any of them after.</p>

      <span style={sub}>Banner</span>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {([["brand", "Brand color"], ["image", "Image"], ["none", "None"]] as const).map(([v, t]) => (
          <button key={v} type="button" style={chip(d.banner === v)} onClick={() => {
            apply({ banner: v });
            if (v === "image" && companyBanner && !(values[DESIGN_KEYS.bannerImage] ?? "").trim()) setValues((x) => ({ ...x, [DESIGN_KEYS.bannerImage]: companyBanner }));
          }}>{t}</button>
        ))}
      </div>
      {d.banner === "image" ? (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={values[DESIGN_KEYS.bannerImage] ?? ""} onChange={(e) => setValues((x) => ({ ...x, [DESIGN_KEYS.bannerImage]: e.target.value }))} placeholder="Banner image link (1200 x 360)" aria-label="Banner image link" style={inp} />
          {upBtn(DESIGN_KEYS.bannerImage)}
        </div>
      ) : null}

      <span style={sub}>Logo</span>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {([["icfo", "iCFO"], ["icapos", "iCapOS"], ["company", "Company logo"]] as const).map(([v, t]) => (
          <button key={v} type="button" style={chip(d.logo === v)} onClick={() => apply({ logo: v })}>{t}</button>
        ))}
      </div>
      {d.logo === "company" ? (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={values[DESIGN_KEYS.logoImage] ?? ""} onChange={(e) => setValues((x) => ({ ...x, [DESIGN_KEYS.logoImage]: e.target.value }))} placeholder="Company logo link" aria-label="Company logo link" style={inp} />
          {upBtn(DESIGN_KEYS.logoImage)}
        </div>
      ) : null}

      <span style={sub}>Accent color <span style={{ fontWeight: 400 }}>· headings and button</span></span>
      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
        {swatches.map((c) => (
          <button key={c} type="button" aria-label={`Accent ${c}`} title={c === bannerColor ? "From the company banner" : c} onClick={() => apply({ accent: c })}
            style={{ width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer", border: "0.5px solid rgba(0,0,0,.2)", outline: d.accent.toLowerCase() === c.toLowerCase() ? "2px solid #2E78F5" : "none", outlineOffset: 2 }} />
        ))}
        <input key={d.accent} defaultValue={d.accent} onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) apply({ accent: v }); }} aria-label="Accent color hex" placeholder="#1A6CE4" style={{ ...inp, width: 88 }} />
        {bannerColor ? <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>last swatch: from the banner</span> : null}
      </div>

      <span style={sub}>Banner text</span>
      <div style={{ display: "flex", gap: 5 }}>
        {([["left", "Left"], ["center", "Center"]] as const).map(([v, t]) => (
          <button key={v} type="button" style={chip(d.align === v)} onClick={() => apply({ align: v })}>{t}</button>
        ))}
      </div>
    </div>
  );
}
