"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

type RequestRow = {
  id: string;
  document_name: string;
  deal_label: string | null;
  status: string;
  signer_name: string | null;
  signer_email: string | null;
  page_count: number;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-50 text-blue-700",
  viewed: "bg-amber-50 text-amber-800",
  signed: "bg-teal-50 text-teal-800",
  completed: "bg-emerald-50 text-emerald-800",
  voided: "bg-red-50 text-red-700",
};

export function SignaturesIndexClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/signatures");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load.");
        if (active) setRows(data.requests ?? []);
      } catch (err) {
        if (active) toast({ title: "Could not load", description: err instanceof Error ? err.message : "", variant: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [toast]);

  const onUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/admin/signatures/upload", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
        toast({ title: "Uploaded", description: "Now place your fields.", variant: "success" });
        router.push(`/admin/signatures/${data.request.id}`);
      } catch (err) {
        toast({ title: "Upload failed", description: err instanceof Error ? err.message : "", variant: "error" });
      } finally {
        setUploading(false);
      }
    },
    [router, toast],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">iCFO Capital Global, Inc.</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
            <FileSignature className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden /> E-signatures
          </h1>
          <p className="mt-1 text-sm text-slate-600">Upload a PDF, place fields, and send it for signature. (Word? Save it as PDF first.)</p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="cap-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload document"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No documents yet. Upload a PDF or Word file to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Document</th>
                <th className="px-4 py-2.5 font-semibold">Signer</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Pages</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/admin/signatures/${r.id}`)}
                  className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.document_name}</p>
                    {r.deal_label ? <p className="text-xs text-slate-500">{r.deal_label}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.signer_name ?? r.signer_email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? "bg-slate-100 text-slate-700"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.page_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
