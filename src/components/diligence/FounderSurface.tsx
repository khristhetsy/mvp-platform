"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Upload, Send, Loader2, FileCheck2, FileDown } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { StateChip } from "./StateChip";
import type { FounderView } from "@/lib/diligence/founder";
import type { Disposition, Severity, Verification } from "@/lib/diligence/types";

const DISPOSITIONS: Disposition[] = ["agree", "remediating", "clarify", "dispute", "awaiting"];

export function FounderSurface({ engagementId, view }: { engagementId: string; view: FounderView }) {
  const router = useRouter();
  const { toast } = useToast();
  const { engagement, findings, docRequests, responses } = view;

  const [picked, setPicked] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [disposition, setDisposition] = useState<Disposition>("agree");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const toggle = (code: string) => setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/founder/diligence/${engagementId}/responses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finding_codes: picked, body: body.trim(), disposition }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submit failed.");
      toast({ title: "Response submitted", variant: "success" });
      setPicked([]); setBody(""); setDisposition("agree");
      router.refresh();
    } catch (err) {
      toast({ title: "Could not submit", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [engagementId, picked, body, disposition, router, toast]);

  const upload = useCallback(async (file: File, docRequestId: string | null, key: string) => {
    setUploadingId(key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (docRequestId) fd.append("doc_request_id", docRequestId);
      const res = await fetch(`/api/founder/diligence/${engagementId}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      toast({ title: "Document uploaded", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({ title: "Could not upload", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setUploadingId(null);
    }
  }, [engagementId, router, toast]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6cb0]">{engagement.report_code}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
          Diligence — {engagement.company_name} <StateChip variant={engagement.lifecycle_stage as "responding"} />
        </h1>
        <p className="mt-1 text-sm text-slate-600">Review each finding, respond, and upload supporting documents.</p>
        <a href={`/api/founder/diligence/${engagementId}/export`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <FileDown className="h-4 w-4" /> Download PDF
        </a>
      </div>

      {/* Findings */}
      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
        <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Findings ({findings.length})</h2>
        {findings.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No findings have been shared yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {findings.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-4 py-3">
                <input type="checkbox" checked={picked.includes(f.finding_code)} onChange={() => toggle(f.finding_code)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{f.finding_code}</span>
                    <span className="font-medium text-slate-900">{f.title}</span>
                    <StateChip variant={f.severity as Severity} />
                    <StateChip variant={f.verification as Verification} />
                  </div>
                  {f.detail ? <p className="mt-1 text-sm text-slate-600">{f.detail}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Response form */}
      {findings.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
          <h2 className="text-sm font-semibold text-slate-800">Respond {picked.length ? `to ${picked.join(", ")}` : "(select findings above)"}</h2>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Your response…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">Disposition
              <select value={disposition} onChange={(e) => setDisposition(e.target.value as Disposition)} className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm capitalize">
                {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void submit()} disabled={submitting || picked.length === 0 || !body.trim()} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#2f6cb0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit response
            </button>
          </div>
        </section>
      ) : null}

      {/* Data-room requests */}
      {docRequests.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Document requests</h2>
          <ul className="divide-y divide-slate-50">
            {docRequests.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{d.label}</p>
                  <p className="text-xs text-slate-500">{d.category}{d.due_date ? ` · due ${d.due_date}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StateChip variant={d.status === "verified" ? "verified" : d.status === "submitted" ? "submitted" : "requested"} />
                  <input ref={(el) => { fileRefs.current[d.id] = el; }} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, d.id, d.id); e.target.value = ""; }} />
                  <button type="button" onClick={() => fileRefs.current[d.id]?.click()} disabled={uploadingId === d.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {uploadingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Submitted responses */}
      {responses.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
          <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Your responses</h2>
          <ul className="divide-y divide-slate-50">
            {responses.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <FileCheck2 className="h-4 w-4 text-[#1d7a4d]" />
                  <span className="font-mono">{r.finding_codes.join(", ")}</span>
                  <span className="capitalize">· {r.disposition}</span>
                  {r.locked ? <span className="rounded bg-slate-100 px-1.5 py-0.5">locked</span> : null}
                </div>
                <p className="mt-1 text-sm text-slate-700">{r.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
