"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

type Props = { requestId: string; documentName: string };

export function SignatureSendClient({ requestId, documentName }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerCompany, setSignerCompany] = useState("");
  const [dealLabel, setDealLabel] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/signatures/${requestId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load.");
        if (!active) return;
        const r = data.request;
        setSignerName(r.signer_name ?? "");
        setSignerEmail(r.signer_email ?? "");
        setSignerCompany(r.signer_company ?? "");
        setDealLabel(r.deal_label ?? "");
        setStatus(r.status);
        if (r.access_token) setSentUrl(`${window.location.origin}/sign/${r.access_token}`);
      } catch (err) {
        if (active) toast({ title: "Could not load", description: err instanceof Error ? err.message : "", variant: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [requestId, toast]);

  const saveDetails = useCallback(async () => {
    const res = await fetch(`/api/admin/signatures/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signer_name: signerName.trim() || null,
        signer_email: signerEmail.trim() || null,
        signer_company: signerCompany.trim() || null,
        deal_label: dealLabel.trim() || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Could not save details.");
    }
  }, [requestId, signerName, signerEmail, signerCompany, dealLabel]);

  const send = useCallback(async () => {
    setSending(true);
    try {
      await saveDetails();
      const res = await fetch(`/api/admin/signatures/${requestId}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed.");
      setStatus("sent");
      setSentUrl(data.signUrl);
      toast({
        title: data.delivered ? "Invite sent" : "Envelope sent",
        description: data.delivered ? `Emailed to ${signerEmail}.` : "Email isn't configured — copy the link below to share it.",
        variant: "success",
      });
    } catch (err) {
      toast({ title: "Could not send", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setSending(false);
    }
  }, [requestId, saveDetails, signerEmail, toast]);

  const copyLink = useCallback(() => {
    if (!sentUrl) return;
    void navigator.clipboard.writeText(sentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sentUrl]);

  const isSent = status !== "draft";

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">Send for signature</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{documentName}</h1>
      </div>

      {isSent && sentUrl ? (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">This envelope has been sent.</p>
          <div className="flex items-center gap-2">
            <input readOnly value={sentUrl} className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700" />
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <button type="button" onClick={() => router.push("/admin/signatures")} className="text-sm font-medium text-emerald-800 underline">
            Back to all documents
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
          <Field label="Signer name" value={signerName} onChange={setSignerName} placeholder="Jane Counterparty" />
          <Field label="Signer email" value={signerEmail} onChange={setSignerEmail} placeholder="jane@company.com" type="email" />
          <Field
            label="Signer company"
            value={signerCompany}
            onChange={setSignerCompany}
            placeholder="Northwind AI, Inc."
            hint="Auto-fills every Company field on the document, read-only to the signer."
          />
          <Field label="Deal label (optional)" value={dealLabel} onChange={setDealLabel} placeholder="Northwind AI" />

          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => router.push(`/admin/signatures/${requestId}`)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to fields
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !signerName.trim() || !signerEmail.trim()}
              className="cap-btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send for signature
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
