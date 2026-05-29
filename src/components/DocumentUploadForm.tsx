"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  companyId: string;
  companyName: string;
  documentTypes: string[];
  maxUploadBytes: number;
};

type UploadResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function isPitchDeck(documentType: string) {
  return documentType === "PITCH_DECK";
}

function allowedAccept(documentType: string) {
  return isPitchDeck(documentType) ? ".pdf" : ".pdf,.doc,.docx,.xls,.xlsx,.csv";
}

function validateClientSide(file: File, documentType: string, maxUploadBytes: number): string | null {
  if (file.size > maxUploadBytes) {
    return `File is too large. Max size is ${formatBytes(maxUploadBytes)}.`;
  }

  if (isPitchDeck(documentType) && file.type !== "application/pdf") {
    return "Pitch decks must be uploaded as a PDF.";
  }

  return null;
}

function toMessage(status: number, body: unknown) {
  const fallback = status >= 500 ? "Upload failed. Please try again." : "Upload failed.";
  if (body && typeof body === "object" && "error" in body && typeof (body as any).error === "string") {
    return (body as any).error as string;
  }
  return fallback;
}

export function DocumentUploadForm({ companyId, companyName, documentTypes, maxUploadBytes }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [documentType, setDocumentType] = useState("PITCH_DECK");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const accept = useMemo(() => allowedAccept(documentType), [documentType]);

  async function uploadOnce() {
    const file = fileRef.current?.files?.[0] ?? null;
    if (!file) {
      setResult({ ok: false, status: 0, message: "Please choose a file to upload." });
      return;
    }

    const validationError = validateClientSide(file, documentType, maxUploadBytes);
    if (validationError) {
      setResult({ ok: false, status: 0, message: validationError });
      return;
    }

    setIsUploading(true);
    setResult(null);
    setProgress(0);

    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("documentType", documentType);
    formData.set("file", file);

    const response = await new Promise<{ status: number; body: unknown }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/documents/upload");

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const pct = Math.round((event.loaded / event.total) * 100);
        setProgress(Math.max(0, Math.min(100, pct)));
      };

      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          body = xhr.responseText;
        }
        resolve({ status: xhr.status, body });
      };

      xhr.onerror = () => resolve({ status: 0, body: { error: "Network error. Please try again." } });
      xhr.send(formData);
    });

    setIsUploading(false);
    setProgress(null);

    if (response.status >= 200 && response.status < 300) {
      setResult({ ok: true });
      router.refresh();
      return;
    }

    setResult({ ok: false, status: response.status, message: toMessage(response.status, response.body) });
  }

  async function uploadWithRetry() {
    // One retry for transient failures (0, 429, 5xx)
    await uploadOnce();
    if (result?.ok === false && (result.status === 0 || result.status === 429 || result.status >= 500)) {
      await new Promise((r) => setTimeout(r, 650));
      await uploadOnce();
    }
  }

  return (
    <div className="mt-8 grid gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <p className="text-sm text-slate-600">
        Uploading for <span className="font-semibold text-slate-950">{companyName}</span>
      </p>

      <select
        name="documentType"
        className="rounded-xl border border-slate-300 px-4 py-3"
        value={documentType}
        onChange={(e) => setDocumentType(e.target.value)}
        disabled={isUploading}
      >
        {documentTypes.map((label) => {
          const value = label.toUpperCase().replaceAll(" ", "_");
          return (
            <option key={label} value={value}>
              {label}
            </option>
          );
        })}
      </select>

      <input
        ref={fileRef}
        name="file"
        type="file"
        accept={accept}
        className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-sm"
        required
        disabled={isUploading}
      />

      {progress !== null ? (
        <div className="grid gap-2">
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-slate-950" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-600">{progress}%</p>
        </div>
      ) : null}

      {result?.ok === true ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Upload complete.</p>
      ) : null}
      {result?.ok === false ? (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <p>{result.message}</p>
          {result.status === 409 ? (
            <p className="mt-1 text-red-600">Tip: remove the existing pitch deck first, or upload a different document type.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          type="button"
          onClick={() => void uploadWithRetry()}
          disabled={isUploading}
        >
          {isUploading ? "Uploading..." : "Upload document"}
        </button>
        {result?.ok === false ? (
          <button
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:opacity-60"
            type="button"
            onClick={() => void uploadOnce()}
            disabled={isUploading}
          >
            Retry
          </button>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">Max upload size: {formatBytes(maxUploadBytes)}.</p>
    </div>
  );
}

