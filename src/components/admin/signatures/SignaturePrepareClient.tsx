"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pen, Calendar, Building2, Type, Trash2, Save, Loader2, Download, Ban, UserRound, Briefcase, Lock, X, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/ToastProvider";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { DEFAULT_TITLE_OPTIONS, type FieldOptions, type FieldType } from "@/lib/esignature/types";

type PrepT = (key: string, values?: Record<string, string | number>) => string;

/** "countersign" exists only in contract mode: iCFO's own signature box, saved on the contract. */
type ToolType = FieldType | "countersign";
const COUNTERSIGN_LABEL = "Your countersignature";
const toolLabel = (t: PrepT, type: ToolType) => (type === "countersign" ? COUNTERSIGN_LABEL : t(`field.${type}`));

type PlacedField = {
  uid: string;
  field_type: ToolType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  placeholder: string | null;
  /** Title fields: the choices the founder picks from. */
  options?: FieldOptions | null;
};

type Props = {
  requestId: string;
  documentName: string;
  status: string;
  pageCount: number;
  /** Sales Hub contract upload: adds the countersignature box and returns to the contract when done. */
  contract?: { docId: string; backHref: string };
};

const TOOLS: { type: ToolType; labelKey: string; icon: typeof Pen }[] = [
  { type: "signature", labelKey: "field.signature", icon: Pen },
  { type: "name", labelKey: "field.name", icon: UserRound },
  { type: "title", labelKey: "field.title", icon: Briefcase },
  { type: "date", labelKey: "field.date", icon: Calendar },
  { type: "company", labelKey: "field.company", icon: Building2 },
  { type: "text", labelKey: "field.text", icon: Type },
];

// Default field box size as a fraction of page dimensions.
const DEFAULT_W = 0.22;
const DEFAULT_H = 0.05;

const FIELD_COLORS: Record<ToolType, string> = {
  countersign: "#B7791F",
  signature: "#2E78F5",
  date: "#1D9E75",
  company: "#BA7517",
  text: "#185FA5",
  initial: "#993556",
  name: "#7C3AED",
  title: "#0E7490",
};

type AuditEvent = { id: string; event_type: string; actor: string | null; ip_address: string | null; created_at: string };

const STATUS_KEYS = ["draft", "sent", "viewed", "signed", "completed", "voided"];
function statusLabel(t: PrepT, s: string) {
  return STATUS_KEYS.includes(s) ? t(`status.${s}`) : s;
}

export function SignaturePrepareClient({ requestId, documentName, status, pageCount, contract }: Props) {
  const contractDocId = contract?.docId ?? null;
  const contractBack = contract?.backHref ?? null;
  const t = useTranslations("signaturesAdmin.prepare");
  const router = useRouter();
  const { toast } = useToast();
  const [tool, setTool] = useState<ToolType>("signature");
  const [fields, setFields] = useState<PlacedField[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [liveStatus, setLiveStatus] = useState(status);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [voiding, setVoiding] = useState(false);
  const editable = liveStatus === "draft";

  // ── Load existing fields + status + audit ─────────────────────────────────
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/signatures/${requestId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load.");
        if (!active) return;
        setFields(
          (data.fields ?? []).map((f: PlacedField & { id: string }) => ({
            uid: f.id,
            field_type: f.field_type,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required,
            placeholder: f.placeholder,
            options: f.options ?? null,
          })),
        );
        if (contractDocId) {
          const c = await fetch(`/api/admin/sales/contracts/${contractDocId}/placement`).then((r) => r.json()).catch(() => ({}));
          const boxes = (c.countersign ?? []) as { page: number; x: number; y: number; width: number; height: number }[];
          if (active && boxes.length) setFields((prev) => [...prev, ...boxes.map((b) => ({ ...b, uid: crypto.randomUUID(), field_type: "countersign" as const, required: true, placeholder: null }))]);
        }
        setSignedUrl(data.signedUrl ?? null);
        setAudit(data.audit ?? []);
        if (data.request?.status) setLiveStatus(data.request.status);
      } catch (err) {
        if (active) toast({ title: t("couldNotLoadDoc"), description: err instanceof Error ? err.message : "", variant: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [requestId, toast, t, contractDocId]);

  const addField = useCallback(
    (page: number, x: number, y: number) => {
      if (!editable) return;
      const uid = crypto.randomUUID();
      setFields((prev) => [
        ...prev,
        {
          uid,
          field_type: tool,
          page,
          x: clamp(x - DEFAULT_W / 2, 0, 1 - DEFAULT_W),
          y: clamp(y - DEFAULT_H / 2, 0, 1 - DEFAULT_H),
          width: DEFAULT_W,
          height: DEFAULT_H,
          required: true,
          placeholder: tool === "text" ? t("textPlaceholderDefault") : null,
          options: tool === "title" ? { choices: [...DEFAULT_TITLE_OPTIONS.choices], multiple: DEFAULT_TITLE_OPTIONS.multiple } : null,
        },
      ]);
      setSelected(uid);
    },
    [tool, editable, t],
  );

  const updateField = useCallback((uid: string, patch: Partial<PlacedField>) => {
    setFields((prev) => prev.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));
  }, []);

  const removeField = useCallback((uid: string) => {
    setFields((prev) => prev.filter((f) => f.uid !== uid));
    setSelected((s) => (s === uid ? null : s));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/signatures/${requestId}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: fields.filter((f) => f.field_type !== "countersign").map((f) => ({
            field_type: f.field_type,
            page: f.page,
            x: round(f.x),
            y: round(f.y),
            width: round(f.width),
            height: round(f.height),
            required: f.required,
            placeholder: f.placeholder,
            ...(f.field_type === "title" ? { options: f.options ?? DEFAULT_TITLE_OPTIONS } : {}),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      if (contractDocId) {
        const boxes = fields.filter((f) => f.field_type === "countersign").map((f) => ({ page: f.page, x: round(f.x), y: round(f.y), width: round(f.width), height: round(f.height) }));
        const cr = await fetch(`/api/admin/sales/contracts/${contractDocId}/placement`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countersign: boxes }) });
        if (!cr.ok) throw new Error(((await cr.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save your countersignature box.");
      }
      toast({ title: t("fieldsSaved"), variant: "success" });
      return true;
    } catch (err) {
      toast({ title: t("couldNotSave"), description: err instanceof Error ? err.message : "", variant: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [fields, requestId, toast, t, contractDocId]);

  const voidEnvelope = useCallback(async () => {
    if (!(await confirmDialog({ message: t("voidConfirm"), danger: true, confirmLabel: t("voidConfirmLabel") }))) return;
    setVoiding(true);
    try {
      const res = await fetch(`/api/admin/signatures/${requestId}/void`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Void failed.");
      setLiveStatus("voided");
      toast({ title: t("envelopeVoided"), variant: "success" });
    } catch (err) {
      toast({ title: t("couldNotVoid"), description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setVoiding(false);
    }
  }, [requestId, toast, t]);

  const canVoid = ["draft", "sent", "viewed"].includes(liveStatus);
  const [newChoice, setNewChoice] = useState("");

  // Pinned bar: when the full header scrolls out of view, show a compact copy
  // fixed to the top of the scrolling area. Measured on scroll rather than CSS
  // sticky, so it holds whatever wraps the page.
  const headerRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const target: HTMLElement | Window = scroller ?? window;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const top = scroller ? Math.max(0, scroller.getBoundingClientRect().top) : 0;
      if (r.bottom <= top + 8) {
        setPinned((prev) => (prev && prev.top === top && prev.left === r.left && prev.width === r.width ? prev : { top, left: r.left, width: r.width }));
      } else {
        setPinned((prev) => (prev ? null : prev));
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    measure();
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [loading]);

  const selectedField = fields.find((f) => f.uid === selected) ?? null;

  const toolButton = ({ type, labelKey, icon: Icon }: { type: ToolType; labelKey: string; icon: typeof Pen }) => (
    <button
      key={type}
      type="button"
      onClick={() => setTool(type)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        tool === type ? "text-white" : "text-slate-700 hover:bg-slate-100"
      }`}
      style={tool === type ? { background: FIELD_COLORS[type] } : undefined}
    >
      <Icon className="h-4 w-4" /> {labelKey ? t(labelKey) : toolLabel(t, type)}
    </button>
  );

  const titleOptions = selectedField?.field_type === "title" ? selectedField.options ?? DEFAULT_TITLE_OPTIONS : null;
  const setTitleOptions = (next: FieldOptions) => selectedField && updateField(selectedField.uid, { options: next });
  const addChoice = () => {
    const c = newChoice.trim().replace(/,/g, " ").replace(/\s+/g, " ").slice(0, 40);
    if (!titleOptions || !c || titleOptions.choices.some((x) => x.toLowerCase() === c.toLowerCase()) || titleOptions.choices.length >= 12) return;
    setTitleOptions({ ...titleOptions, choices: [...titleOptions.choices, c] });
    setNewChoice("");
  };

  const selectedPanel = (selectedField && editable ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-3 text-sm shadow-[var(--shadow-panel)]">
          <span className="font-medium text-slate-800">{t("fieldOf", { type: toolLabel(t, selectedField.field_type) })}</span>
          <label className="flex items-center gap-1.5 text-slate-600">
            <input
              type="checkbox"
              checked={selectedField.required}
              onChange={(e) => updateField(selectedField.uid, { required: e.target.checked })}
            />
            {t("required")}
          </label>
          {selectedField.field_type === "text" ? (
            <label className="flex items-center gap-1.5 text-slate-600">
              {t("placeholder")}
              <input
                type="text"
                value={selectedField.placeholder ?? ""}
                onChange={(e) => updateField(selectedField.uid, { placeholder: e.target.value })}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          ) : null}
          {selectedField.field_type === "company" ? (
            <span className="text-xs text-slate-500">{t("autofillCompany")}</span>
          ) : null}
          {selectedField.field_type === "date" ? (
            <span className="text-xs text-slate-500">{t("autofillDate")}</span>
          ) : null}
          {selectedField.field_type === "name" ? (
            <span className="text-xs text-slate-500">{t("autofillName")}</span>
          ) : null}
          {selectedField.field_type === "countersign" ? (
            <span className="text-xs text-slate-500">{t("countersignHint")}</span>
          ) : null}
          <button
            type="button"
            onClick={() => removeField(selectedField.uid)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> {t("remove")}
          </button>
          {titleOptions ? (
            <div className="w-full space-y-2 border-t border-slate-100 pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">{t("titleChoices")}</span>
                {titleOptions.choices.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs text-cyan-800">
                    {c}
                    {titleOptions.choices.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove ${c}`}
                        onClick={() => setTitleOptions({ ...titleOptions, choices: titleOptions.choices.filter((x) => x !== c) })}
                        className="text-cyan-700 hover:text-cyan-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </span>
                ))}
                <input
                  type="text"
                  value={newChoice}
                  onChange={(e) => setNewChoice(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChoice(); } }}
                  placeholder={t("titleAddChoice")}
                  maxLength={40}
                  className="w-32 rounded border border-slate-300 px-2 py-0.5 text-xs"
                />
                <button type="button" onClick={addChoice} disabled={!newChoice.trim()} className="inline-flex items-center rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label={t("titleAddChoice")}>
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={titleOptions.multiple} onChange={(e) => setTitleOptions({ ...titleOptions, multiple: e.target.checked })} />
                {t("titleMultiple")}
              </label>
            </div>
          ) : null}
        </div>
      ) : null);

  // A compact tool: icon only, except the active tool keeps its label.
  const compactTool = ({ type, labelKey, icon: Icon }: { type: ToolType; labelKey: string; icon: typeof Pen }) => {
    const label = labelKey ? t(labelKey) : toolLabel(t, type);
    const on = tool === type;
    return (
      <button
        key={type}
        type="button"
        onClick={() => setTool(type)}
        title={label}
        aria-label={label}
        aria-pressed={on}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${on ? "text-white" : "text-slate-700 hover:bg-slate-100"}`}
        style={on ? { background: FIELD_COLORS[type] } : undefined}
      >
        <Icon className="h-4 w-4" />
        {on ? label : null}
      </button>
    );
  };

  const primaryActions = editable ? (
    <>
      {contract ? (
        <button
          type="button"
          onClick={() => void save().then((ok) => ok && contractBack && router.push(contractBack))}
          disabled={saving || !fields.some((f) => f.field_type === "signature") || !fields.some((f) => f.field_type === "countersign")}
          title="Place at least one signature box for the prospect and your countersignature box"
          className="cap-btn-secondary whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          Save and return
        </button>
      ) : (
        <button
          type="button"
          onClick={() => router.push(`/admin/signatures/${requestId}/send`)}
          disabled={fields.length === 0}
          className="cap-btn-secondary whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {t("continueSend")}
        </button>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="cap-btn-primary inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("saveFields")}
      </button>
    </>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Full header. Once it scrolls out of view, the compact bar below takes its place, pinned. */}
      {pinned && editable ? (
        <div
          className="fixed z-30 space-y-2 border-b border-slate-200 bg-[var(--background)] px-1 py-2 shadow-[0_8px_14px_-12px_rgba(15,23,42,0.45)]"
          style={{ top: pinned.top, left: pinned.left, width: pinned.width }}
          role="toolbar"
          aria-label="Place fields"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 max-w-[340px] truncate text-sm font-semibold text-slate-900" title={documentName}>{documentName}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{statusLabel(t, liveStatus)}</span>
            <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-slate-200/80 bg-white p-1 shadow-[var(--shadow-panel)]">
              {TOOLS.map(compactTool)}
            </div>
            {contractDocId ? (
              <div className="flex items-center gap-0.5 rounded-xl border border-dashed border-amber-300 bg-white p-1 shadow-[var(--shadow-panel)]">
                <Lock className="ml-1 h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                {compactTool({ type: "countersign", labelKey: "", icon: Pen })}
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-2">{primaryActions}</div>
          </div>
          {selectedPanel}
        </div>
      ) : null}

      <div ref={headerRef} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("prepareDocument")}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            {documentName}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{statusLabel(t, liveStatus)}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {signedUrl ? (
            <a href={signedUrl} target="_blank" rel="noreferrer" className="cap-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold">
              <Download className="h-4 w-4" /> {t("signedPdf")}
            </a>
          ) : null}
          {canVoid && !contract ? (
            <button
              type="button"
              onClick={() => void voidEnvelope()}
              disabled={voiding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" /> {t("voidBtn")}
            </button>
          ) : null}
          {editable ? (
            <>
              {contract ? (
                <button
                  type="button"
                  onClick={() => void save().then((ok) => ok && contractBack && router.push(contractBack))}
                  disabled={saving || !fields.some((f) => f.field_type === "signature") || !fields.some((f) => f.field_type === "countersign")}
                  title="Place at least one signature box for the prospect and your countersignature box"
                  className="cap-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Save and return to the contract
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push(`/admin/signatures/${requestId}/send`)}
                  disabled={fields.length === 0}
                  className="cap-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {t("continueSend")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="cap-btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("saveFields")}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {!editable ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("readonlyNotice", { status: statusLabel(t, liveStatus).toLowerCase() })}
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-stretch gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/80 bg-white p-2 shadow-[var(--shadow-panel)]">
              <span className="px-2 text-xs font-medium text-slate-500">{contractDocId ? t("founderFills") : t("place")}</span>
              {TOOLS.map(toolButton)}
            </div>
            {contractDocId ? (
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-dashed border-amber-300 bg-white p-2 shadow-[var(--shadow-panel)]">
                <span className="inline-flex items-center gap-1 px-2 text-xs font-medium text-slate-500">
                  <Lock className="h-3.5 w-3.5 text-amber-600" /> {t("youAfter")}
                </span>
                {toolButton({ type: "countersign", labelKey: "", icon: Pen })}
              </div>
            ) : null}
          </div>
          <p className="px-1 text-xs text-slate-500">
            {t("dropHint", { tool: toolLabel(t, tool) })}
            {contractDocId ? ` · ${t("signingOrder")}` : ""}
          </p>
        </div>
      )}

      {pinned ? null : selectedPanel}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{t("loadingDoc")}</p>
      ) : (
        <PdfPlacementSurface
          requestId={requestId}
          pageCount={pageCount}
          fields={fields}
          selected={selected}
          editable={editable}
          colors={FIELD_COLORS}
          onAdd={addField}
          onSelect={setSelected}
          onUpdate={updateField}
        />
      )}

      {audit.length > 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">{t("auditTrail")}</h2>
          <ol className="space-y-1.5">
            {audit.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                <span className="inline-block w-20 font-medium capitalize text-slate-900">{e.event_type}</span>
                <span>{new Date(e.created_at).toLocaleString()}</span>
                {e.actor ? <span className="text-slate-400">· {e.actor}</span> : null}
                {e.ip_address ? <span className="text-slate-400">· {e.ip_address}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

// ── PDF rendering + placement surface ─────────────────────────────────────────
function PdfPlacementSurface({
  requestId,
  pageCount,
  fields,
  selected,
  editable,
  colors,
  onAdd,
  onSelect,
  onUpdate,
}: {
  requestId: string;
  pageCount: number;
  fields: PlacedField[];
  selected: string | null;
  editable: boolean;
  colors: Record<ToolType, string>;
  onAdd: (page: number, x: number, y: number) => void;
  onSelect: (uid: string | null) => void;
  onUpdate: (uid: string, patch: Partial<PlacedField>) => void;
}) {
  const t = useTranslations("signaturesAdmin.prepare");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Render every page to a canvas with pdfjs.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Worker served from the same version on a CSP-allowed CDN.
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

        const res = await fetch(`/api/admin/signatures/${requestId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load document.");
        const url: string | null = data.previewUrl;
        if (!url) throw new Error(t("previewUnavailable"));

        const pdf = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;

        for (let n = 1; n <= pdf.numPages; n++) {
          const canvas = document.getElementById(`sig-canvas-${n}`) as HTMLCanvasElement | null;
          if (!canvas) continue;
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale: 1.4 });
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("couldNotRender"));
      }
    })();
    return () => { cancelled = true; };
  }, [requestId, t]);

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
        <PdfPage
          key={pageNum}
          pageNum={pageNum}
          fields={fields.filter((f) => f.page === pageNum)}
          selected={selected}
          editable={editable}
          colors={colors}
          onAdd={onAdd}
          onSelect={onSelect}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function PdfPage({
  pageNum,
  fields,
  selected,
  editable,
  colors,
  onAdd,
  onSelect,
  onUpdate,
}: {
  pageNum: number;
  fields: PlacedField[];
  selected: string | null;
  editable: boolean;
  colors: Record<ToolType, string>;
  onAdd: (page: number, x: number, y: number) => void;
  onSelect: (uid: string | null) => void;
  onUpdate: (uid: string, patch: Partial<PlacedField>) => void;
}) {
  const t = useTranslations("signaturesAdmin.prepare");
  const wrapRef = useRef<HTMLDivElement>(null);

  const handlePageClick = (e: React.MouseEvent) => {
    if (!editable) return;
    // Clicks land on the canvas (which fills the wrapper) — place relative to the
    // wrapper rect. Clicks on placed fields stopPropagation, so they won't reach here.
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    onAdd(pageNum, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };

  const startDrag = (e: React.PointerEvent, field: PlacedField, mode: "move" | "resize") => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(field.uid);
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...field };

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (mode === "move") {
        onUpdate(field.uid, {
          x: clamp(orig.x + dx, 0, 1 - orig.width),
          y: clamp(orig.y + dy, 0, 1 - orig.height),
        });
      } else {
        onUpdate(field.uid, {
          width: clamp(orig.width + dx, 0.05, 1 - orig.x),
          height: clamp(orig.height + dy, 0.025, 1 - orig.y),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="mx-auto w-fit rounded-lg border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
      <div
        ref={wrapRef}
        onClick={handlePageClick}
        className={`relative ${editable ? "cursor-crosshair" : ""}`}
      >
        <canvas id={`sig-canvas-${pageNum}`} className="block max-w-full" />
        {fields.map((f) => (
          <div
            key={f.uid}
            onPointerDown={(e) => startDrag(e, f, "move")}
            onClick={(e) => { e.stopPropagation(); onSelect(f.uid); }}
            className="absolute flex items-center justify-center rounded text-[11px] font-medium"
            style={{
              left: `${f.x * 100}%`,
              top: `${f.y * 100}%`,
              width: `${f.width * 100}%`,
              height: `${f.height * 100}%`,
              border: `2px solid ${colors[f.field_type]}`,
              background: `${colors[f.field_type]}1A`,
              color: colors[f.field_type],
              outline: selected === f.uid ? `2px solid ${colors[f.field_type]}` : "none",
              outlineOffset: 2,
              cursor: editable ? "move" : "default",
            }}
          >
            <span className="pointer-events-none select-none">
              {toolLabel(t, f.field_type)}
              {f.required ? " *" : ""}
            </span>
            {editable ? (
              <span
                onPointerDown={(e) => startDrag(e, f, "resize")}
                className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-white"
                style={{ background: colors[f.field_type] }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}
