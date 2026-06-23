"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pen, Calendar, Building2, Type, Trash2, Save, Loader2, Download, Ban } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { FieldType } from "@/lib/esignature/types";

type PlacedField = {
  uid: string;
  field_type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  placeholder: string | null;
};

type Props = {
  requestId: string;
  documentName: string;
  status: string;
  pageCount: number;
};

const TOOLS: { type: FieldType; label: string; icon: typeof Pen }[] = [
  { type: "signature", label: "Signature", icon: Pen },
  { type: "date", label: "Date", icon: Calendar },
  { type: "company", label: "Company", icon: Building2 },
  { type: "text", label: "Text", icon: Type },
];

// Default field box size as a fraction of page dimensions.
const DEFAULT_W = 0.22;
const DEFAULT_H = 0.05;

const FIELD_COLORS: Record<FieldType, string> = {
  signature: "#534AB7",
  date: "#1D9E75",
  company: "#BA7517",
  text: "#185FA5",
  initial: "#993556",
};

type AuditEvent = { id: string; event_type: string; actor: string | null; ip_address: string | null; created_at: string };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", viewed: "Viewed", signed: "Signed", completed: "Completed", voided: "Voided",
};

export function SignaturePrepareClient({ requestId, documentName, status, pageCount }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [tool, setTool] = useState<FieldType>("signature");
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
          })),
        );
        setSignedUrl(data.signedUrl ?? null);
        setAudit(data.audit ?? []);
        if (data.request?.status) setLiveStatus(data.request.status);
      } catch (err) {
        if (active) toast({ title: "Could not load document", description: err instanceof Error ? err.message : "", variant: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [requestId, toast]);

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
          placeholder: tool === "text" ? "Title / capacity" : null,
        },
      ]);
      setSelected(uid);
    },
    [tool, editable],
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
          fields: fields.map((f) => ({
            field_type: f.field_type,
            page: f.page,
            x: round(f.x),
            y: round(f.y),
            width: round(f.width),
            height: round(f.height),
            required: f.required,
            placeholder: f.placeholder,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      toast({ title: "Fields saved", variant: "success" });
    } catch (err) {
      toast({ title: "Could not save", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  }, [fields, requestId, toast]);

  const voidEnvelope = useCallback(async () => {
    if (!(await confirmDialog({ message: "Void this envelope? The signer will no longer be able to sign it.", danger: true, confirmLabel: "Void" }))) return;
    setVoiding(true);
    try {
      const res = await fetch(`/api/admin/signatures/${requestId}/void`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Void failed.");
      setLiveStatus("voided");
      toast({ title: "Envelope voided", variant: "success" });
    } catch (err) {
      toast({ title: "Could not void", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setVoiding(false);
    }
  }, [requestId, toast]);

  const canVoid = ["draft", "sent", "viewed"].includes(liveStatus);

  const selectedField = fields.find((f) => f.uid === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">Prepare document</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            {documentName}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{STATUS_LABELS[liveStatus] ?? liveStatus}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {signedUrl ? (
            <a href={signedUrl} target="_blank" rel="noreferrer" className="cap-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold">
              <Download className="h-4 w-4" /> Signed PDF
            </a>
          ) : null}
          {canVoid ? (
            <button
              type="button"
              onClick={() => void voidEnvelope()}
              disabled={voiding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" /> Void
            </button>
          ) : null}
          {editable ? (
            <>
              <button
                type="button"
                onClick={() => router.push(`/admin/signatures/${requestId}/send`)}
                disabled={fields.length === 0}
                className="cap-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Continue to send →
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="cap-btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save fields
              </button>
            </>
          ) : null}
        </div>
      </div>

      {!editable ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This envelope is {STATUS_LABELS[liveStatus]?.toLowerCase() ?? liveStatus}. Fields are read-only.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-2 shadow-[var(--shadow-panel)]">
          <span className="px-2 text-xs font-medium text-slate-500">Place:</span>
          {TOOLS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => setTool(type)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tool === type ? "text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
              style={tool === type ? { background: FIELD_COLORS[type] } : undefined}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
          <span className="ml-auto px-2 text-xs text-slate-500">Click a page to drop a {tool} field</span>
        </div>
      )}

      {selectedField && editable ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-3 text-sm shadow-[var(--shadow-panel)]">
          <span className="font-medium capitalize text-slate-800">{selectedField.field_type} field</span>
          <label className="flex items-center gap-1.5 text-slate-600">
            <input
              type="checkbox"
              checked={selectedField.required}
              onChange={(e) => updateField(selectedField.uid, { required: e.target.checked })}
            />
            Required
          </label>
          {selectedField.field_type === "text" ? (
            <label className="flex items-center gap-1.5 text-slate-600">
              Placeholder
              <input
                type="text"
                value={selectedField.placeholder ?? ""}
                onChange={(e) => updateField(selectedField.uid, { placeholder: e.target.value })}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          ) : null}
          {selectedField.field_type === "company" ? (
            <span className="text-xs text-slate-500">Auto-fills from the recipient&apos;s company (read-only to signer)</span>
          ) : null}
          {selectedField.field_type === "date" ? (
            <span className="text-xs text-slate-500">Auto-fills with the signing date</span>
          ) : null}
          <button
            type="button"
            onClick={() => removeField(selectedField.uid)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading document…</p>
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
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Audit trail</h2>
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
  colors: Record<FieldType, string>;
  onAdd: (page: number, x: number, y: number) => void;
  onSelect: (uid: string | null) => void;
  onUpdate: (uid: string, patch: Partial<PlacedField>) => void;
}) {
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
        if (!url) throw new Error("Document preview is unavailable.");

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
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not render the PDF.");
      }
    })();
    return () => { cancelled = true; };
  }, [requestId]);

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
  colors: Record<FieldType, string>;
  onAdd: (page: number, x: number, y: number) => void;
  onSelect: (uid: string | null) => void;
  onUpdate: (uid: string, patch: Partial<PlacedField>) => void;
}) {
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
            <span className="pointer-events-none select-none capitalize">
              {f.field_type}
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
