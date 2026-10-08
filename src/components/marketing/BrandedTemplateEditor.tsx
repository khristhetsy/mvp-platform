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
import { TERM_FIELDS, addTermLine, hasTermLine, removeTermLine } from "@/lib/email/founder-fields";
import { ACCENT_SWATCHES, DESIGN_KEYS, dominantColor, hasDesign, mapFounderValues, readDesign, suggestLooks, writeDesign, type DesignSettings, type Look } from "@/lib/email/design";

type Master = { id: string; name: string; description: string; compiled_html: string; placeholder_schema: PlaceholderSchema };
type FounderRef = { kind: "project" | "company"; id: string };
type FounderField = { key: string; label: string; value: string };
type Prefill = {
  ref: FounderRef; label: string; source: string; recordUrl: string;
  values: Record<string, string>; sources: Record<string, string>; website?: string | null; fields: FounderField[];
};
type FounderOption = { ref: FounderRef; label: string; sub: string };
const refKey = (r: FounderRef) => `${r.kind}:${r.id}`;
/** Stored on the template so Edit reopens on the same founder. */
const FOUNDER_KEY = "founder_ref";

/** Starting values for a design: saved defaults, then the founder's data mapped onto its fields. */
function startValues(masterName: string, defaults: Record<string, string>, prefill: Prefill | null): Record<string, string> {
  const mapped = prefill ? mapFounderValues(masterName, prefill.values, prefill.website) : {};
  const v: Record<string, string> = { ...defaults, ...mapped };
  if (!(v.cta_url ?? "").trim() && mapped.cta_url_fallback) v.cta_url = mapped.cta_url_fallback;
  delete v.cta_url_fallback;
  if (prefill) v[FOUNDER_KEY] = refKey(prefill.ref);
  return v;
}

/** Template fields each founder field feeds, per design. */
const TERMS_FIELDS = ["raise", "funding_stage", "capital_type", "revenue", "use_of_funds"];
function usedBy(masterName: string): Record<string, string[]> {
  const terms = (slot: string) => Object.fromEntries(TERMS_FIELDS.map((k) => [k, [slot]]));
  const common = { website: ["cta_url"] };
  if (masterName === "Deal introduction") return { ...common, company_name: ["company_name", "headline"], body: ["body"], considerations: ["considerations"], ...terms("terms"), hero_image: ["hero_image"] };
  if (masterName === "Announcement") return { ...common, company_name: ["headline"], body: ["body"], hero_image: [DESIGN_KEYS.bannerImage], logo_image: [DESIGN_KEYS.logoImage] };
  if (masterName === "Newsletter") return { ...common, company_name: ["headline"], body: ["intro"], considerations: ["section_one_body"], ...terms("section_two_body"), hero_image: [DESIGN_KEYS.bannerImage], logo_image: [DESIGN_KEYS.logoImage] };
  if (masterName === "Promo") return { ...common, company_name: ["headline"], body: ["subhead"], hero_image: [DESIGN_KEYS.bannerImage], logo_image: [DESIGN_KEYS.logoImage] };
  return common;
}

/** Which founder value fed each field of a design (keys of the founder prefill). */
const FOUNDER_FIELD: Record<string, Record<string, string>> = {
  Announcement: { headline: "headline", body: "body" },
  Newsletter: { headline: "headline", intro: "body", section_one_body: "considerations", section_two_body: "terms" },
  Promo: { headline: "headline", subhead: "body" },
};
/** Founder fields taken out of the email (comma list) and values inserted with "+ Insert" ({ field: slot }); saved with the template. */
const OFF_KEY = "founder_off";
const INS_KEY = "founder_inserted";
const readOff = (s: Record<string, string>) => new Set((s[OFF_KEY] ?? "").split(",").filter(Boolean));
function readIns(s: Record<string, string>): Record<string, string> {
  try { const v = JSON.parse(s[INS_KEY] || "{}") as unknown; return v && typeof v === "object" ? (v as Record<string, string>) : {}; } catch { return {}; }
}
/** The field a design puts terms lines in. */
const termSlot = (masterName: string) => (masterName === "Deal introduction" ? "terms" : masterName === "Newsletter" ? "section_two_body" : null);
const IMAGE_SLOTS = new Set<string>([DESIGN_KEYS.bannerImage, DESIGN_KEYS.logoImage, "hero_image"]);

/** Take one founder field out of the email: its terms line goes, or the fields it filled are cleared. */
function excludeField(masterName: string, s: Record<string, string>, key: string, defaults: Record<string, string>): Record<string, string> {
  const out = { ...s };
  const ts = termSlot(masterName);
  if (TERM_FIELDS.includes(key)) {
    if (ts) {
      out[ts] = removeTermLine(out[ts] ?? "", key);
      if (masterName === "Newsletter" && !out[ts].trim()) out.section_two_title = "";
    }
    return out;
  }
  for (const t of usedBy(masterName)[key] ?? []) {
    if (IMAGE_SLOTS.has(t)) continue;
    out[t] = t === "cta_url" ? (defaults.cta_url ?? "") : "";
  }
  if (masterName === "Newsletter" && key === "considerations") out.section_one_title = "";
  return out;
}

/** Put a removed founder field back, the way the founder fill puts it in. */
function includeField(masterName: string, s: Record<string, string>, key: string, prefill: Prefill): Record<string, string> {
  const out = { ...s };
  const ts = termSlot(masterName);
  if (TERM_FIELDS.includes(key)) {
    const f = prefill.fields.find((x) => x.key === key);
    if (ts && f) {
      out[ts] = addTermLine(out[ts] ?? "", key, f.value);
      if (masterName === "Newsletter" && !(out.section_two_title ?? "").trim()) out.section_two_title = "Terms";
    }
    return out;
  }
  const fresh = startValues(masterName, {}, prefill);
  for (const t of usedBy(masterName)[key] ?? []) if (!IMAGE_SLOTS.has(t) && fresh[t] !== undefined) out[t] = fresh[t];
  if (masterName === "Newsletter" && key === "considerations" && fresh.section_one_title) out.section_one_title = fresh.section_one_title;
  return out;
}

/** Re-apply the template's removed fields after a fill. */
function applyOff(masterName: string, s: Record<string, string>, off: Set<string>, defaults: Record<string, string>): Record<string, string> {
  let out = { ...s };
  for (const k of off) out = excludeField(masterName, out, k, defaults);
  if (off.size) out[OFF_KEY] = [...off].join(",");
  return out;
}

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
  const [founderBusy, setFounderBusy] = useState(false);
  /** Last content field clicked, where "+ Insert" puts founder data. */
  const [lastField, setLastField] = useState<string | null>(null);

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
          // Reopen on the template's founder: the panel and Refill use it; the saved text stays.
          const saved = ej.copy.slot_values?.[FOUNDER_KEY];
          if (saved) {
            const f = await fetch(`/api/marketing/branded-templates?founder=${encodeURIComponent(saved)}`);
            const fj = (await f.json().catch(() => null)) as { prefill?: Prefill | null } | null;
            if (alive && fj?.prefill) setPrefill(fj.prefill);
          }
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

  /** Switch the founder: load their data and refill the content (design settings stay). */
  async function chooseFounder(ref: FounderRef | null) {
    const keepDesign = (v: Record<string, string>) =>
      Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith("design_") || k === DESIGN_KEYS.logoImage || k === DESIGN_KEYS.bannerImage));
    if (!ref) {
      setPrefill(null);
      setSlots((p) => ({ ...startValues(master?.name ?? "", defaults, null), ...keepDesign(p) }));
      return;
    }
    setFounderBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/marketing/branded-templates?founder=${encodeURIComponent(refKey(ref))}`);
      const j = (await r.json().catch(() => null)) as { prefill?: Prefill | null; error?: string } | null;
      if (!r.ok || !j?.prefill) { setMsg(j?.error ?? "Couldn't load that founder."); return; }
      const pf = j.prefill;
      setPrefill(pf);
      setSlots((p) => {
        const next = applyOff(master?.name ?? "", { ...keepDesign(p), ...startValues(master?.name ?? "", defaults, pf) }, readOff(p), defaults);
        // A new founder brings their own banner and logo when they have them.
        if (!pf.values.hero_image) delete next[DESIGN_KEYS.bannerImage];
        if (!pf.values.logo_image) delete next[DESIGN_KEYS.logoImage];
        return next;
      });
    } catch { setMsg("Couldn't load that founder."); } finally { setFounderBusy(false); }
  }

  /** "+ Insert": add a founder value to the field last clicked (or the main text field). */
  function insertFounder(key: string, value: string) {
    const target = (lastField && fields.some((f) => f.key === lastField) ? lastField : null)
      ?? fields.find((f) => f.type === "richtext" || f.type === "textarea")?.key ?? fields[0]?.key;
    if (!target) return;
    const slot = fields.find((f) => f.key === target);
    const multi = slot?.type === "richtext" || slot?.type === "textarea" || slot?.type === "list" || slot?.type === "terms";
    setSlots((p) => {
      const cur = (p[target] ?? "").trim();
      const ins = { ...readIns(p), [key]: target };
      return { ...p, [target]: cur ? `${cur}${multi ? (slot?.type === "richtext" ? "\n\n" : "\n") : " "}${value}` : value, [INS_KEY]: JSON.stringify(ins) };
    });
    setMsg(`Inserted into ${slot?.label ?? target}.`);
  }

  /** "Undo" on an inserted value: take it back out of the field it went into. */
  function undoInsert(key: string) {
    const value = prefill?.fields.find((f) => f.key === key)?.value ?? "";
    setSlots((p) => {
      const ins = readIns(p);
      const target = ins[key];
      delete ins[key];
      const next: Record<string, string> = { ...p, [INS_KEY]: JSON.stringify(ins) };
      if (target && value) {
        const cur = p[target] ?? "";
        const i = cur.lastIndexOf(value);
        if (i >= 0) {
          let start = i;
          while (start > 0 && /\s/.test(cur[start - 1])) start--;
          next[target] = (cur.slice(0, start) + cur.slice(i + value.length)).replace(/^\s+/, "");
        }
      }
      return next;
    });
  }

  /** "Remove" / "Add back" on a founder field. */
  function toggleField(key: string, include: boolean) {
    if (!master || !prefill) return;
    setSlots((p) => {
      const off = readOff(p);
      if (include) off.delete(key); else off.add(key);
      const next = include ? includeField(master.name, p, key, prefill) : excludeField(master.name, p, key, defaults);
      return { ...next, [OFF_KEY]: [...off].join(",") };
    });
  }

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
    const name = masters.find((m) => m.id === id)?.name ?? "";
    setSlots((p) => applyOff(name, startValues(name, defaults, prefill), readOff(p), defaults));
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

        <FounderBar
          prefill={prefill}
          busy={founderBusy}
          onPick={(ref) => void chooseFounder(ref)}
          onRefill={() => setSlots((p) => { const v = startValues(master?.name ?? "", {}, prefill); delete v.cta_url; return applyOff(master?.name ?? "", { ...p, ...v }, readOff(p), defaults); })}
        />

        {loading ? (
          <div style={{ padding: 24, fontSize: 13, color: "var(--muted-foreground)" }}>Loading…</div>
        ) : (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", overflow: "hidden" }}>
            {/* Left: content fields from the design's schema */}
            <div style={{ overflowY: "auto", padding: "4px 16px 16px", borderRight: "0.5px solid var(--border)" }}>
              {prefill && master ? (
                <FounderDataPanel prefill={prefill} masterName={master.name} slots={slots} slotLabel={(k) => (fields.find((f) => f.key === k)?.label ?? (k === DESIGN_KEYS.bannerImage ? "Banner" : k === DESIGN_KEYS.logoImage ? "Logo" : k)).replace(/\s*\(.*\)\s*$/, "").replace(/^Hero banner URL$/, "Banner")}
                  hasDesign={hasDesign(schema)}
                  onInsert={insertFounder}
                  onToggle={toggleField}
                  onUndo={undoInsert}
                  onUseLogo={(url) => setSlots((p) => writeDesign({ ...p, [DESIGN_KEYS.logoImage]: url }, { logo: "company" }))} />
              ) : null}

              {fields.map((s) => (
                <div key={s.key}>
                  <label htmlFor={`bt-${s.key}`} style={label}>
                    {s.label}{s.required ? <span style={{ color: "#A32D2D" }}> *</span> : null}
                    {prefill ? <SourceTag source={sourceFor(s.key)} missing={s.key === "hero_image" && !(slots.hero_image ?? "").trim() ? "not in record: upload" : null} /> : null}
                  </label>
                  {prefill && s.key === "terms" && master?.name === "Deal introduction" ? (
                    <div style={{ margin: "0 0 4px" }}><SourceTag source={undefined} missing="not in record: add interest, maturity, discount, warrants as lines" /></div>
                  ) : null}
                  {s.type === "textarea" || s.type === "richtext" || s.type === "list" || s.type === "terms" ? (
                    <textarea id={`bt-${s.key}`} value={slots[s.key] ?? ""} maxLength={s.max_length} onChange={(e) => set(s.key, e.target.value)} onFocus={() => setLastField(s.key)}
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
                      onChange={(e) => set(s.key, e.target.value)} onFocus={() => setLastField(s.key)} style={inp} />
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

/** "Working on": the founder this template is for, with search to switch or clear. */
function FounderBar({ prefill, busy, onPick, onRefill }: Readonly<{
  prefill: Prefill | null; busy: boolean; onPick: (ref: FounderRef | null) => void; onRefill: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<FounderOption[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/marketing/branded-templates/founders?q=${encodeURIComponent(q)}`);
        const j = (await r.json().catch(() => null)) as { founders?: FounderOption[] } | null;
        if (alive) setOptions(j?.founders ?? []);
      } finally { if (alive) setLoading(false); }
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [open, q]);
  const groups: Array<[string, FounderOption[]]> = [
    ["Investor Relations projects", options.filter((o) => o.ref.kind === "project")],
    ["iCapOS founder accounts", options.filter((o) => o.ref.kind === "company")],
  ];
  const current = prefill ? refKey(prefill.ref) : "";
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: prefill ? "#EAF3DE" : "var(--muted, #f4f5f7)", color: prefill ? "#27500A" : "var(--muted-foreground)", fontSize: 12.5, borderBottom: "0.5px solid var(--border)" }}>
      <i className={`ti ${prefill ? "ti-user-check" : "ti-user-question"}`} aria-hidden="true" />
      <span>Working on</span>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ ...inp, width: 380, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "#fff", textAlign: "left" }}>
        {busy ? <span>Loading…</span> : prefill ? (
          <><b style={{ color: "var(--foreground)" }}>{prefill.label}</b><span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>{prefill.source}</span></>
        ) : <span style={{ color: "var(--muted-foreground)" }}>Pick a founder to fill from their record</span>}
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} aria-hidden="true" style={{ marginLeft: "auto" }} />
      </button>
      {prefill ? (
        <button type="button" onClick={onRefill} style={{ ...btn, marginLeft: "auto", background: "#fff", padding: "4px 10px" }}>
          <i className="ti ti-refresh" aria-hidden="true" /> Refill from founder
        </button>
      ) : null}
      {open ? (
        <div style={{ position: "absolute", top: "calc(100% - 2px)", left: 108, zIndex: 5, width: 420, background: "#fff", border: "0.5px solid var(--border)", borderRadius: 9, boxShadow: "0 10px 26px rgba(0,0,0,0.14)", overflow: "hidden", color: "var(--foreground)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: "0.5px solid var(--border)" }}>
            <i className="ti ti-search" aria-hidden="true" style={{ color: "var(--muted-foreground)" }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search founders or companies" aria-label="Search founders or companies"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 12.5, background: "transparent", color: "var(--foreground)" }} />
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {loading && options.length === 0 ? <div style={{ padding: 10, fontSize: 12, color: "var(--muted-foreground)" }}>Searching…</div> : null}
            {groups.map(([title, list]) => list.length ? (
              <div key={title}>
                <div style={{ padding: "7px 10px 3px", fontSize: 10.5, color: "var(--muted-foreground)" }}>{title}</div>
                {list.map((o) => {
                  const on = refKey(o.ref) === current;
                  return (
                    <button key={refKey(o.ref)} type="button" onClick={() => { setOpen(false); onPick(o.ref); }}
                      style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "6px 10px", border: "none", cursor: "pointer", textAlign: "left", fontSize: 12.5, background: on ? "#E6F1FB" : "transparent", color: on ? "#0C447C" : "var(--foreground)" }}>
                      {on ? <i className="ti ti-check" aria-hidden="true" /> : null}{o.label}
                    </button>
                  );
                })}
              </div>
            ) : null)}
            {!loading && options.length === 0 ? <div style={{ padding: 10, fontSize: 12, color: "var(--muted-foreground)" }}>No founders match “{q}”.</div> : null}
          </div>
          <button type="button" onClick={() => { setOpen(false); onPick(null); }}
            style={{ display: "flex", width: "100%", alignItems: "center", gap: 6, padding: "8px 10px", border: "none", borderTop: "0.5px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--muted-foreground)" }}>
            <i className="ti ti-x" aria-hidden="true" /> No founder (blank template)
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Everything in the founder's record, with where each piece is used or "+ Insert". */
function FounderDataPanel({ prefill, masterName, slots, slotLabel, hasDesign: designable, onInsert, onToggle, onUndo, onUseLogo }: Readonly<{
  prefill: Prefill; masterName: string; slots: Record<string, string>; slotLabel: (key: string) => string;
  hasDesign: boolean; onInsert: (key: string, value: string) => void; onToggle: (key: string, include: boolean) => void; onUndo: (key: string) => void; onUseLogo: (url: string) => void;
}>) {
  const off = readOff(slots);
  const ins = readIns(slots);
  const ts = termSlot(masterName);
  const targetsOf = (f: FounderField) => TERM_FIELDS.includes(f.key)
    ? (ts && hasTermLine(slots[ts] ?? "", f.key) ? [ts] : [])
    : (usedBy(masterName)[f.key] ?? []).filter((k) => {
      const v = (slots[k] ?? "").trim();
      if (!v) return false;
      if (k === "cta_url") return v === f.value.trim();
      if (k === DESIGN_KEYS.logoImage) return slots[DESIGN_KEYS.logo] === "company" && v === f.value.trim();
      return true;
    });
  const SECTION_NAMES: Record<string, string> = { section_one_body: "Highlights section", section_two_body: "Terms section" };
  const nameOf = (k: string) => SECTION_NAMES[k] ?? slotLabel(k);
  const inserted = (f: FounderField) => !!ins[f.key] && (slots[ins[f.key]] ?? "").includes(f.value);
  const inEmail = prefill.fields.filter((f) => !off.has(f.key) && (targetsOf(f).length > 0 || inserted(f))).length;
  const link: React.CSSProperties = { fontSize: 10.5, color: "var(--muted-foreground)", background: "transparent", border: "none", cursor: "pointer", padding: "1px 2px", whiteSpace: "nowrap" };
  const [open, setOpen] = useState(true);
  const tag = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 10.5, padding: "1px 6px", borderRadius: 6, background: bg, color: fg, whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" });
  return (
    <div style={{ margin: "10px 0 4px", border: "0.5px solid var(--border)", borderRadius: 9 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ display: "flex", width: "100%", alignItems: "center", gap: 6, padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", color: "var(--foreground)" }}>
        <i className={`ti ti-chevron-${open ? "down" : "right"}`} aria-hidden="true" />
        <b style={{ fontSize: 12.5 }}>Founder data</b>
        <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{prefill.fields.length} fields · {inEmail} in email</span>
        <a href={prefill.recordUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ marginLeft: "auto", fontSize: 11, color: "#185FA5" }}>
          Open founder record <i className="ti ti-external-link" aria-hidden="true" />
        </a>
      </button>
      {open ? (
        <div style={{ padding: "0 10px 6px" }}>
          {prefill.fields.map((f) => {
            const targets = targetsOf(f);
            const isOff = off.has(f.key);
            const isImage = targets.some((t) => IMAGE_SLOTS.has(t));
            const isLogo = f.key === "logo_image";
            return (
              <div key={f.key} style={{ display: "grid", gridTemplateColumns: "92px minmax(0,1fr) auto", gap: 6, alignItems: "start", padding: "5px 0", borderTop: "0.5px solid var(--border)", fontSize: 11.5 }}>
                <span style={{ color: "var(--muted-foreground)", textDecoration: isOff ? "line-through" : undefined }}>{f.label}</span>
                <span style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word", textDecoration: isOff ? "line-through" : undefined, color: isOff ? "var(--muted-foreground)" : undefined }} title={f.value}>{isLogo ? f.value.split("/").pop() : f.value}</span>
                {isOff ? <button type="button" onClick={() => onToggle(f.key, true)} title="Put this back in the email" style={{ ...tag("transparent", "#185FA5"), border: "0.5px solid #B5D4F4", cursor: "pointer" }}>+ Add back</button>
                  : targets.length ? (
                    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                      <span style={tag("#EAF3DE", "#3B6D11")} title={[...new Set(targets.map(nameOf))].join(", ")}>{isImage || targets.includes("cta_url") ? "" : "In "}{[...new Set(targets.map(nameOf))].join(", ")}</span>
                      {isImage ? null : <button type="button" onClick={() => onToggle(f.key, false)} title="Take this out of the email" style={link}>✕ Remove</button>}
                    </span>
                  )
                  : inserted(f) ? (
                    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                      <span style={tag("#EAF3DE", "#3B6D11")} title={nameOf(ins[f.key])}>Inserted</span>
                      <button type="button" onClick={() => onUndo(f.key)} title={`Take it out of ${nameOf(ins[f.key])}`} style={link}>✕ Undo</button>
                    </span>
                  )
                  : isLogo ? (designable ? <button type="button" onClick={() => onUseLogo(f.value)} style={{ ...tag("transparent", "#185FA5"), border: "0.5px solid #B5D4F4", cursor: "pointer" }}>Use as logo</button> : <span style={tag("transparent", "var(--muted-foreground)")}>not in this design</span>)
                  : f.key === "hero_image" ? <span style={tag("transparent", "var(--muted-foreground)")}>{designable ? "pick Image in Design" : "not in this design"}</span>
                  : <button type="button" onClick={() => onInsert(f.key, f.value)} style={{ ...tag("transparent", "#185FA5"), border: "0.5px solid #B5D4F4", cursor: "pointer" }}>+ Insert</button>}
              </div>
            );
          })}
          {!prefill.fields.some((f) => f.key === "logo_image") ? (
            <div style={{ display: "grid", gridTemplateColumns: "92px minmax(0,1fr) auto", gap: 6, padding: "5px 0", borderTop: "0.5px solid var(--border)", fontSize: 11.5 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Logo</span>
              <span style={{ color: "var(--muted-foreground)" }}>not in record</span>
              <span style={tag("transparent", "var(--muted-foreground)")}>{designable ? "upload in Design" : ""}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
