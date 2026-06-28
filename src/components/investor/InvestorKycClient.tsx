"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Upload, AlertTriangle, FileText, Loader2, ShieldCheck } from "lucide-react";
import type { InvestorKycStatus } from "@/lib/investor/types";
import { KYC_STATUS_LABELS } from "@/lib/investor/kyc";

export type KycItemView = {
  code: string;
  label: string;
  description: string;
  required: boolean;
  uploaded: boolean;
  fileName: string | null;
  signedUrl: string | null;
};

const STATUS_BANNER: Record<InvestorKycStatus, { tone: string; icon: typeof Clock; title: string; body: string }> = {
  not_started: {
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    icon: ShieldCheck,
    title: "Verify your identity & accreditation",
    body: "Upload the documents below, then submit for review. Verification unlocks expressing interest, intros, SPVs, and full data rooms.",
  },
  pending: {
    tone: "border-[#B5D4F4] bg-[#E6F1FB] text-[#0C447C]",
    icon: Clock,
    title: "Verification under review",
    body: "Your documents are with the CapitalOS team. We'll email you the moment you're verified — usually within a day or two.",
  },
  verified: {
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: CheckCircle2,
    title: "You're verified",
    body: "Your identity and accreditation are verified. You have full access to deal flow.",
  },
  rejected: {
    tone: "border-rose-200 bg-rose-50 text-rose-900",
    icon: AlertTriangle,
    title: "Verification needs attention",
    body: "One or more documents couldn't be accepted. Review the note below, re-upload, and resubmit.",
  },
};

export function InvestorKycClient({
  kycStatus,
  kycFeedback,
  items,
  canSubmit,
  legalName: initialLegalName,
  kycConsent,
}: Readonly<{
  kycStatus: InvestorKycStatus;
  kycFeedback: string | null;
  items: KycItemView[];
  canSubmit: boolean;
  legalName: string | null;
  kycConsent: boolean;
}>) {
  const router = useRouter();
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragCode, setDragCode] = useState<string | null>(null);
  const [legalName, setLegalName] = useState(initialLegalName ?? "");
  const [consent, setConsent] = useState(kycConsent);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const locked = kycStatus === "pending" || kycStatus === "verified";
  const banner = STATUS_BANNER[kycStatus];
  const BannerIcon = banner.icon;
  const readyToSubmit = canSubmit && legalName.trim().length >= 2 && consent;

  async function upload(code: string, file: File) {
    setError(null);
    setBusyCode(code);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("docType", code);
      const res = await fetch("/api/investor/kyc/upload", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusyCode(null);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/investor/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalName: legalName.trim(), consent }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not submit for verification.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit for verification.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className={`flex gap-3 rounded-2xl border p-4 ${banner.tone}`}>
        <BannerIcon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.9} aria-hidden />
        <div>
          <p className="text-sm font-semibold">{banner.title}</p>
          <p className="mt-1 text-[13px] leading-6 opacity-90">{banner.body}</p>
          {kycStatus === "rejected" && kycFeedback ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-white/80 px-3 py-2 text-[13px] text-rose-900">
              <span className="font-semibold">What to fix:</span> {kycFeedback}
            </p>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
      ) : null}

      {!locked ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block text-sm font-semibold text-slate-900" htmlFor="kyc-legal-name">
            Legal name <span className="text-[11px] font-normal text-slate-400">· as it appears on your ID</span>
          </label>
          <input
            id="kyc-legal-name"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="e.g. Jordan A. Investor"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
          />
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const busy = busyCode === item.code;
          return (
            <div key={item.code} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    {item.required ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Required</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">Optional</span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-slate-500">{item.description}</p>
                  {item.uploaded ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-emerald-700">
                      <FileText className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
                      {item.signedUrl ? (
                        <a href={item.signedUrl} target="_blank" rel="noreferrer" className="underline hover:text-emerald-800">
                          {item.fileName ?? "Uploaded"}
                        </a>
                      ) : (
                        <span>{item.fileName ?? "Uploaded"}</span>
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0">
                  {item.uploaded ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" strokeWidth={1.9} aria-hidden />
                  ) : null}
                </div>
              </div>

              {!locked ? (
                <div className="mt-3">
                  <input
                    ref={(el) => {
                      inputs.current[item.code] = el;
                    }}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void upload(item.code, file);
                      e.target.value = "";
                    }}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Upload ${item.label}`}
                    onClick={() => !busy && inputs.current[item.code]?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") inputs.current[item.code]?.click();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragCode(item.code);
                    }}
                    onDragLeave={() => setDragCode(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragCode(null);
                      const file = e.dataTransfer.files?.[0];
                      if (file) void upload(item.code, file);
                    }}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 text-[13px] font-medium transition ${
                      dragCode === item.code
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
                    ) : (
                      <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />
                    )}
                    {item.uploaded ? "Drag & drop to replace, or click" : "Drag & drop your file, or click to browse"}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {kycStatus !== "verified" ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {!locked ? (
            <label className="flex items-start gap-2.5 text-[13px] text-slate-600">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I consent to CapitalOS storing this document to verify my identity. It&apos;s encrypted, private, and never
                shown to founders.
              </span>
            </label>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-slate-600">
              {locked
                ? `Status: ${KYC_STATUS_LABELS[kycStatus]}.`
                : readyToSubmit
                  ? "Ready — submit for verification."
                  : "Add your legal name, upload your ID, and consent to submit."}
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={!readyToSubmit || locked || submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden /> : null}
              Submit for verification
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
