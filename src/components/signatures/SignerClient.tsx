"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { FieldType, AutoSource } from "@/lib/esignature/types";
import { BRAND } from "@/lib/esignature/types";
import { SignaturePad } from "./SignaturePad";

type SignField = {
  id: string;
  field_type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  placeholder: string | null;
  auto_source: AutoSource | null;
};

type Props = {
  token: string;
  documentName: string;
  dealLabel: string | null;
  signerName: string | null;
  signerCompany: string | null;
  consentAccepted: boolean;
  pageCount: number;
  previewUrl: string | null;
  signingDate: string;
  fields: SignField[];
};

const ACCENT = "#2E78F5";

export function SignerClient(props: Props) {
  const t = useTranslations("sharedCmp");
  const [consented, setConsented] = useState(props.consentAccepted);
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeSig, setActiveSig] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptConsent = useCallback(async () => {
    setConsented(true);
    try {
      await fetch(`/api/sign/${props.token}/consent`, { method: "POST" });
    } catch {
      // best-effort; the submit endpoint re-validates consent server-side
    }
  }, [props.token]);

  const autoValue = useCallback(
    (f: SignField): string | null => {
      if (f.auto_source === "signing_date" || f.field_type === "date") return props.signingDate;
      if (f.auto_source === "signer_company" || f.field_type === "company") return props.signerCompany ?? "";
      return null;
    },
    [props.signingDate, props.signerCompany],
  );

  const isFilled = useCallback(
    (f: SignField): boolean => {
      if (autoValue(f) !== null) return true;
      return Boolean((values[f.id] ?? "").trim());
    },
    [autoValue, values],
  );

  const requiredRemaining = props.fields.filter((f) => f.required && !isFilled(f)).length;

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${props.token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }, [props.token, values]);

  if (done) {
    return (
      <Shell>
        <div style={{ textAlign: "center", maxWidth: 460, margin: "0 auto", paddingTop: 80 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{t("thank_you_you_re_done")}</h1>
          <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.6 }}>
            Your signature has been recorded for <strong>{props.documentName}</strong>. A sealed copy will be emailed to you shortly.
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 24 }}>{BRAND.sealStamp}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #e5e7eb", background: "white", position: "sticky", top: 0, zIndex: 20 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: ACCENT, margin: 0, letterSpacing: "0.04em" }}>{BRAND.productName}</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "2px 0 0" }}>{props.documentName}{props.dealLabel ? ` · ${props.dealLabel}` : ""}</p>
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!consented || requiredRemaining > 0 || submitting}
          style={{ background: !consented || requiredRemaining > 0 ? "#c7c5e6" : ACCENT, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: !consented || requiredRemaining > 0 || submitting ? "not-allowed" : "pointer" }}
        >
          {submitting ? "Submitting…" : requiredRemaining > 0 ? `${requiredRemaining} field${requiredRemaining === 1 ? "" : "s"} left` : "Finish & sign"}
        </button>
      </header>

      {error ? (
        <p style={{ maxWidth: 820, margin: "12px auto 0", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, fontSize: 14 }}>{error}</p>
      ) : null}

      {!consented ? (
        <div style={{ maxWidth: 820, margin: "16px auto 0", padding: "16px 18px", background: "#EEF0FB", border: `1px solid ${ACCENT}33`, borderRadius: 12 }}>
          <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", fontSize: 14, color: "#1f2937", lineHeight: 1.6 }}>
            <input type="checkbox" onChange={(e) => { if (e.target.checked) void acceptConsent(); }} style={{ marginTop: 3 }} />
            <span>
              I agree to use electronic records and electronic signatures, and to be legally bound by them under the U.S. ESIGN Act and UETA. I understand my signature on this document will be legally binding.
            </span>
          </label>
        </div>
      ) : null}

      <PdfSignSurface
        previewUrl={props.previewUrl}
        pageCount={props.pageCount}
        fields={props.fields}
        consented={consented}
        values={values}
        autoValue={autoValue}
        onText={(id, v) => setValues((p) => ({ ...p, [id]: v }))}
        onOpenSignature={(id) => setActiveSig(id)}
      />

      {activeSig ? (
        <SignaturePad
          signerName={props.signerName}
          onCancel={() => setActiveSig(null)}
          onApply={(dataUrl) => { setValues((p) => ({ ...p, [activeSig]: dataUrl })); setActiveSig(null); }}
        />
      ) : null}
    </Shell>
  );
}

// ── PDF + overlay ─────────────────────────────────────────────────────────────
function PdfSignSurface({
  previewUrl, pageCount, fields, consented, values, autoValue, onText, onOpenSignature,
}: {
  previewUrl: string | null;
  pageCount: number;
  fields: SignField[];
  consented: boolean;
  values: Record<string, string>;
  autoValue: (f: SignField) => string | null;
  onText: (id: string, v: string) => void;
  onOpenSignature: (id: string) => void;
}) {
  const t = useTranslations("sharedCmp");
  const [error, setError] = useState<string | null>(previewUrl ? null : "The document could not be loaded.");

  useEffect(() => {
    if (!previewUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        const pdf = await pdfjs.getDocument({ url: previewUrl }).promise;
        if (cancelled) return;
        for (let n = 1; n <= pdf.numPages; n++) {
          const canvas = document.getElementById(`sign-canvas-${n}`) as HTMLCanvasElement | null;
          if (!canvas) continue;
          const page = await pdf.getPage(n);
          const viewport = page.getViewport({ scale: 1.4 });
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch {
        if (!cancelled) setError("The document could not be rendered.");
      }
    })();
    return () => { cancelled = true; };
  }, [previewUrl]);

  if (error) {
    return <p style={{ maxWidth: 820, margin: "24px auto", color: "#b91c1c", fontSize: 14 }}>{error}</p>;
  }

  return (
    <div style={{ padding: "20px 0 80px" }}>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
        <div key={pageNum} style={{ position: "relative", width: "fit-content", margin: "0 auto 20px", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 1px 4px rgba(12,35,64,0.06)" }}>
          <canvas id={`sign-canvas-${pageNum}`} style={{ display: "block", maxWidth: "100%" }} />
          {fields.filter((f) => f.page === pageNum).map((f) => (
            <FieldOverlay
              key={f.id}
              field={f}
              consented={consented}
              auto={autoValue(f)}
              value={values[f.id] ?? ""}
              onText={onText}
              onOpenSignature={onOpenSignature}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function FieldOverlay({
  field, consented, auto, value, onText, onOpenSignature,
}: {
  field: SignField;
  consented: boolean;
  auto: string | null;
  value: string;
  onText: (id: string, v: string) => void;
  onOpenSignature: (id: string) => void;
}) {
  const t = useTranslations("sharedCmp");
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${field.x * 100}%`,
    top: `${field.y * 100}%`,
    width: `${field.width * 100}%`,
    height: `${field.height * 100}%`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    borderRadius: 4,
    overflow: "hidden",
  };

  // Auto-filled (date / company) — read-only.
  if (auto !== null) {
    return (
      <div style={{ ...style, background: "#f1efe8", border: "1px solid #d3d1c7", color: "#444441", padding: "0 4px" }} title={t("auto_filled")}>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auto || "—"}</span>
      </div>
    );
  }

  const disabled = !consented;

  if (field.field_type === "text" || field.field_type === "initial") {
    return (
      <input
        type="text"
        disabled={disabled}
        value={value}
        placeholder={field.placeholder ?? (field.field_type === "initial" ? "Initials" : "Type here")}
        onChange={(e) => onText(field.id, e.target.value)}
        style={{ ...style, border: `2px solid ${disabled ? "#c7c5e6" : ACCENT}`, background: disabled ? "#f8f9fb" : "#EEF0FB", padding: "0 6px", color: "#1f2937", outline: "none" }}
      />
    );
  }

  // Signature
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onOpenSignature(field.id)}
      style={{ ...style, border: `2px solid ${disabled ? "#c7c5e6" : ACCENT}`, background: value ? "white" : disabled ? "#f8f9fb" : "#EEF0FB", cursor: disabled ? "not-allowed" : "pointer", color: ACCENT, fontWeight: 600, padding: 0 }}
    >
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="signature" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      ) : (
        <span>{field.required ? "Sign *" : "Sign"}</span>
      )}
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "#F8F9FC", fontFamily: "system-ui, -apple-system, sans-serif" }}>{children}</div>;
}
