"use client";

/** Customer pay page: bank details with copy buttons and "I've sent the payment". */
import { useState } from "react";

type Row = { label: string; value: string; copy: boolean; mono?: boolean; strong?: boolean; mask?: boolean };

/** Last four digits only, e.g. "•••• 2522". The copy button still copies the full number. */
export function maskTail(value: string): string {
  const v = value.trim();
  return v.length > 4 ? `•••• ${v.slice(-4)}` : v;
}

export function PayInvoiceClient({
  number, token, rows, note, amount, pdfUrl, reportedAt,
}: Readonly<{ number: string; token: string; rows: Row[]; note: string | null; amount: string; pdfUrl: string; reportedAt: string | null }>) {
  const [copied, setCopied] = useState<string | null>(null);
  const [sent, setSent] = useState<boolean>(Boolean(reportedAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      setError("Couldn't copy. Select the text and copy it instead.");
    }
  }

  async function report() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(number.toLowerCase())}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error ?? "Something went wrong. Try again.");
      else setSent(true);
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <table className="mt-2 w-full text-[13px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-slate-100 last:border-b-0">
              <td className="py-1.5 pr-2 text-slate-500">{r.label}</td>
              <td className={`py-1.5 text-right text-slate-900 ${r.mono ? "font-mono" : ""} ${r.strong ? "font-semibold" : ""}`}>{r.mask && shown !== r.label ? maskTail(r.value) : r.value}
                {r.mask ? (
                  <button type="button" onClick={() => setShown((s) => (s === r.label ? null : r.label))} className="ml-2 font-sans text-[12px] font-medium text-[#185FA5] hover:text-[#1A6CE4]">
                    {shown === r.label ? "Hide" : "Show"}
                  </button>
                ) : null}
              </td>
              <td className="w-8 py-1.5 text-right">
                {r.copy ? (
                  <button type="button" aria-label={`Copy ${r.label}`} onClick={() => copy(r.label, r.value)} className="text-[#185FA5] hover:text-[#1A6CE4]">
                    <i className={`ti ${copied === r.label ? "ti-check" : "ti-copy"}`} aria-hidden="true" />
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <p className="mt-1 text-[12px] text-slate-500">{note}</p> : null}
      <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        Add these details as a payee in your bank&apos;s online banking, send {amount}, and put the reference in the memo so the payment is matched to this invoice.
      </p>

      {sent ? (
        <div className="mt-3.5 flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px]">
          <i className="ti ti-clock mt-0.5 text-[20px] text-[#854F0B]" aria-hidden="true" />
          <div>
            <div className="font-medium text-slate-900">Payment on its way</div>
            <div className="text-[12px] text-slate-500">Wires usually land the same business day. You&apos;ll get a receipt by email once it arrives.</div>
          </div>
        </div>
      ) : null}

      <div className="mt-3.5 flex gap-2">
        {!sent ? (
          <button type="button" disabled={busy} onClick={report} className="flex-1 rounded-lg bg-[#1A6CE4] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#2E78F5] disabled:opacity-50">
            {busy ? "Saving…" : "I've sent the payment"}
          </button>
        ) : null}
        <a href={pdfUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 ${sent ? "flex-1" : ""}`}>
          <i className="ti ti-download" aria-hidden="true" />Invoice PDF
        </a>
      </div>
      {error ? <p className="mt-2 text-[12.5px] text-red-700">{error}</p> : null}
    </div>
  );
}
