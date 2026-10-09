"use client";

/**
 * New invoice (one, or a monthly series such as "$2,000 a month for 4 months")
 * and edit for drafts. "Create and send" emails the first invoice now; the rest
 * of a series send themselves on their dates (daily job, about 6 AM PT).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ENTITIES, addDays, daysBetween, entityName, fmtDate, lineAmount, money, parseMoneyToCents, seriesDates,
  seriesLineLabel, todayPT, type Customer, type EntityId,
} from "@/lib/accounting/core";
import { CustomerEditor } from "@/components/admin/accounting/CustomerEditor";
import { ErrorLine, Field, api, btnCls, inputCls, primaryCls } from "@/components/admin/accounting/ui";

type LineDraft = { key: number; description: string; quantity: string; price: string };

export type InvoiceFormInitial = {
  id: string;
  invoice_number: string;
  customer_id: string;
  entity: EntityId;
  issue_date: string;
  due_date: string;
  memo: string | null;
  lines: Array<{ description: string; quantity: number; unit_cents: number }>;
};

const TERMS = [
  { days: 0, label: "Due on receipt" },
  { days: 7, label: "Net 7" },
  { days: 15, label: "Net 15" },
  { days: 30, label: "Net 30" },
];

let seq = 1;
const blankLine = (): LineDraft => ({ key: seq++, description: "", quantity: "1", price: "" });

export function InvoiceForm({ customers: initialCustomers, initial, presetCustomerId }: Readonly<{ customers: Customer[]; initial?: InvoiceFormInitial; presetCustomerId?: string | null }>) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? presetCustomerId ?? "");
  const [entity, setEntity] = useState<EntityId>(initial?.entity ?? customers.find((c) => c.id === presetCustomerId)?.entity ?? "icfo_capital_global");
  const [issue, setIssue] = useState(initial?.issue_date ?? todayPT());
  const [dueDays, setDueDays] = useState(initial ? daysBetween(initial.issue_date, initial.due_date) : 15);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    initial?.lines.length
      ? initial.lines.map((l) => ({ key: seq++, description: l.description, quantity: String(l.quantity), price: (l.unit_cents / 100).toFixed(2) }))
      : [blankLine()],
  );
  const [repeat, setRepeat] = useState<"once" | "monthly">("once");
  const [count, setCount] = useState("4");
  const [newCustomer, setNewCustomer] = useState(false);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = lines.map((l) => {
    const q = Number(l.quantity);
    const unit = parseMoneyToCents(l.price);
    const ok = l.description.trim() && Number.isFinite(q) && q > 0 && unit !== null && unit >= 0;
    return { ...l, q, unit: unit ?? 0, ok: Boolean(ok), amount: ok ? lineAmount(q, unit ?? 0) : 0 };
  });
  const total = parsed.reduce((t, l) => t + l.amount, 0);
  const n = repeat === "monthly" ? Math.max(2, Math.min(36, Math.floor(Number(count)) || 2)) : 1;
  const schedule = useMemo(() => seriesDates(issue, n, dueDays), [issue, n, dueDays]);
  const customer = customers.find((c) => c.id === customerId) ?? null;

  const setLine = (key: number, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function submit(send: boolean) {
    setError(null);
    if (!customerId) { setError("Choose a customer."); return; }
    if (!parsed.some((l) => l.ok)) { setError("Add at least one line with a description and an amount."); return; }
    if (parsed.some((l) => !l.ok && (l.description.trim() || l.price.trim()))) { setError("Each line needs a description, a quantity above 0 and a price."); return; }
    if (send && !customer?.email) { setError("This customer has no email address. Edit the customer to add one, or save as a draft."); return; }
    const payloadLines = parsed.filter((l) => l.ok).map((l) => ({ description: l.description.trim(), quantity: l.q, unit_cents: l.unit }));
    setBusy(send ? "send" : "draft");
    if (initial) {
      const r = await api<{ invoice: { id: string } }>(`/api/admin/accounting/invoices/${initial.id}`, "PATCH", {
        customer_id: customerId, issue_date: issue, due_date: addDays(issue, dueDays), memo, lines: payloadLines,
      });
      if (!r.ok) { setBusy(null); setError(r.error); return; }
      if (send) {
        const s = await api(`/api/admin/accounting/invoices/${initial.id}`, "POST", { action: "send" });
        if (!s.ok) { setBusy(null); setError(`Saved, but the email failed: ${s.error}`); return; }
      }
      router.push(`/admin/accounting/invoices/${initial.id}`);
      router.refresh();
      return;
    }
    const r = await api<{ invoices: Array<{ id: string }>; emailed: boolean; emailError: string | null }>("/api/admin/accounting/invoices", "POST", {
      entity, customer_id: customerId, issue_date: issue, due_days: dueDays, memo, lines: payloadLines, repeat_count: n, send_now: send,
    });
    if (!r.ok) { setBusy(null); setError(r.error); return; }
    const first = r.data.invoices[0];
    router.push(`/admin/accounting/invoices/${first.id}${r.data.emailError ? `?email_error=${encodeURIComponent(r.data.emailError)}` : ""}`);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Customer">
            <div className="flex gap-2">
              <select className={inputCls} value={customerId} onChange={(e) => { setCustomerId(e.target.value); const c = customers.find((x) => x.id === e.target.value); if (c && !initial) setEntity(c.entity); }}>
                <option value="">Choose a customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{[c.company, c.contact_name].filter(Boolean).join(" · ")}</option>)}
              </select>
              <button type="button" className={btnCls} onClick={() => setNewCustomer(true)}><i className="ti ti-plus" aria-hidden="true" />New</button>
            </div>
            {customer ? <span className="mt-1 block text-[11.5px] text-slate-500">{customer.email ?? "No email on file"}</span> : null}
          </Field>
          <Field label="Billed by">
            <select className={inputCls} value={entity} disabled={Boolean(initial)} onChange={(e) => setEntity(e.target.value as EntityId)}>
              {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label={repeat === "monthly" ? "First invoice date" : "Invoice date"}>
            <input type="date" className={inputCls} value={issue} onChange={(e) => setIssue(e.target.value)} />
          </Field>
          <Field label="Payment terms">
            <select className={inputCls} value={dueDays} onChange={(e) => setDueDays(Number(e.target.value))}>
              {TERMS.map((t) => <option key={t.days} value={t.days}>{t.label}</option>)}
              {TERMS.some((t) => t.days === dueDays) ? null : <option value={dueDays}>Net {dueDays}</option>}
            </select>
          </Field>
        </div>

        <div>
          <div className="mb-1 text-[12.5px] font-medium text-slate-600">Lines</div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-slate-500">
                <th className="py-1 pr-2">Description</th>
                <th className="w-20 py-1 pr-2 text-right">Qty</th>
                <th className="w-32 py-1 pr-2 text-right">Price</th>
                <th className="w-28 py-1 text-right">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {parsed.map((l) => (
                <tr key={l.key}>
                  <td className="py-1 pr-2"><input className={inputCls} value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} placeholder="Advisory services" /></td>
                  <td className="py-1 pr-2"><input className={`${inputCls} text-right`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} /></td>
                  <td className="py-1 pr-2"><input className={`${inputCls} text-right`} inputMode="decimal" value={l.price} onChange={(e) => setLine(l.key, { price: e.target.value })} placeholder="2,000.00" /></td>
                  <td className="py-1 text-right tabular-nums text-slate-900">{money(l.amount)}</td>
                  <td className="py-1 text-right">
                    {lines.length > 1 ? <button type="button" aria-label="Remove line" className="text-slate-400 hover:text-red-600" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><i className="ti ti-trash" aria-hidden="true" /></button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="mt-1 text-[12.5px] font-medium text-[#1A6CE4]" onClick={() => setLines((ls) => [...ls, blankLine()])}>+ Add a line</button>
        </div>

        {!initial ? (
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-4 text-[13px]">
              <label className="flex items-center gap-2"><input type="radio" checked={repeat === "once"} onChange={() => setRepeat("once")} /> One invoice</label>
              <label className="flex items-center gap-2"><input type="radio" checked={repeat === "monthly"} onChange={() => setRepeat("monthly")} /> Monthly for</label>
              <input className={`${inputCls} w-16 text-right`} inputMode="numeric" value={count} disabled={repeat !== "monthly"} onChange={(e) => setCount(e.target.value)} aria-label="Number of months" />
              <span className="text-slate-600">months</span>
            </div>
            {repeat === "monthly" ? <p className="mt-2 text-[12px] text-slate-500">Creates {n} invoices now so they show in A/R. Each is emailed on its own date, and the first email lists the full payment schedule.</p> : null}
          </div>
        ) : null}

        <Field label="Notes on the invoice" hint="Optional. Shown on the PDF.">
          <textarea className={inputCls} rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </Field>
        <ErrorLine text={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={initial ? `/admin/accounting/invoices/${initial.id}` : "/admin/accounting/invoices"} className={btnCls}>Cancel</Link>
          <button type="button" className={btnCls} disabled={busy !== null} onClick={() => submit(false)}>{busy === "draft" ? "Saving…" : initial ? "Save" : "Save as draft"}</button>
          <button type="button" className={primaryCls} disabled={busy !== null} onClick={() => submit(true)}>
            <i className="ti ti-send" aria-hidden="true" />{busy === "send" ? "Sending…" : initial ? "Save and send" : repeat === "monthly" ? "Create and send the first" : "Create and send"}
          </button>
        </div>
      </div>

      <aside className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-[13px]">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Summary</div>
        <div className="text-slate-700">{entityName(entity)}</div>
        <div className="flex justify-between"><span className="text-slate-500">{repeat === "monthly" ? "Each invoice" : "Total"}</span><span className="font-semibold tabular-nums">{money(total)}</span></div>
        {repeat === "monthly" ? <div className="flex justify-between"><span className="text-slate-500">{n} months</span><span className="font-semibold tabular-nums">{money(total * n)}</span></div> : null}
        <div className="border-t border-slate-100 pt-2">
          {schedule.slice(0, 12).map((s, i) => (
            <div key={s.issue_date} className="flex justify-between py-0.5 text-[12.5px]">
              <span className="text-slate-600">{repeat === "monthly" ? `${i + 1}. ` : ""}{fmtDate(s.issue_date)}</span>
              <span className="text-slate-500">due {fmtDate(s.due_date)}</span>
            </div>
          ))}
          {schedule.length > 12 ? <div className="text-[12px] text-slate-500">and {schedule.length - 12} more</div> : null}
        </div>
        {repeat === "monthly" && parsed[0]?.description ? <div className="text-[12px] text-slate-500">Line reads: &ldquo;{seriesLineLabel(parsed[0].description, 1, n)}&rdquo;</div> : null}
        <p className="text-[12px] text-slate-500">Paid by bank transfer. The bank details from Settings print on the invoice.</p>
      </aside>

      {newCustomer ? (
        <CustomerEditor
          onClose={() => setNewCustomer(false)}
          onSaved={(c) => { setCustomers((cs) => [...cs, c]); setCustomerId(c.id); setEntity(c.entity); setNewCustomer(false); }}
        />
      ) : null}
    </div>
  );
}
