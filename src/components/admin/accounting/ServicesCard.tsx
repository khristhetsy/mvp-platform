"use client";

/** Accounting › Settings › Services: the list the invoice line Description dropdown reads. */
import { useState } from "react";
import { ENTITIES, parseMoneyToCents, type Service } from "@/lib/accounting/core";
import { ErrorLine, Section, api, btnCls, inputCls, primaryCls } from "@/components/admin/accounting/ui";

type Row = { id: string; name: string; price: string; entity: Service["entity"] };

const toRow = (s: Service): Row => ({ id: s.id, name: s.name, price: s.unit_cents == null ? "" : (s.unit_cents / 100).toFixed(2), entity: s.entity });
let n = 0;
const blank = (): Row => ({ id: `svc-new${(n++).toString(36)}${Date.now().toString(36)}`.slice(0, 30), name: "", price: "", entity: "both" });

export function ServicesCard({ initial }: Readonly<{ initial: Service[] }>) {
  const [rows, setRows] = useState<Row[]>(initial.map(toRow));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (id: string, patch: Partial<Row>) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); setSaved(false); };

  async function save() {
    setError(null);
    const bad = rows.find((r) => r.name.trim() && r.price.trim() && parseMoneyToCents(r.price) === null);
    if (bad) { setError(`Check the price for "${bad.name}".`); return; }
    setBusy(true);
    const services = rows.filter((r) => r.name.trim()).map((r) => ({ id: r.id, name: r.name, unit_cents: r.price.trim() ? parseMoneyToCents(r.price) : null, entity: r.entity }));
    const res = await api<{ services: Service[] }>("/api/admin/accounting/services", "PUT", { services });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setRows(res.data.services.map(toRow));
    setSaved(true);
  }

  return (
    <Section title="Services" icon="ti-list-details" action={<button type="button" className={btnCls} onClick={() => { setRows((rs) => [...rs, blank()]); setSaved(false); }}><i className="ti ti-plus" aria-hidden="true" />Add service</button>}>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-center text-[12.5px] text-slate-500">No services yet. Add the services you bill so they show in the invoice line dropdown.</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-medium text-slate-500">
              <th className="px-4 py-2">Name (as it prints on the invoice)</th>
              <th className="w-36 px-2 py-2 text-right">Default price</th>
              <th className="w-48 px-2 py-2">Company</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="px-4 py-1.5"><input className={inputCls} value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} placeholder="Advisory services" aria-label="Service name" /></td>
                <td className="px-2 py-1.5"><input className={`${inputCls} text-right`} inputMode="decimal" value={r.price} onChange={(e) => set(r.id, { price: e.target.value })} placeholder="Optional" aria-label="Default price" /></td>
                <td className="px-2 py-1.5">
                  <select className={inputCls} value={r.entity} onChange={(e) => set(r.id, { entity: e.target.value as Row["entity"] })} aria-label="Company">
                    <option value="both">Both companies</option>
                    {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.short}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-right"><button type="button" aria-label={`Remove ${r.name || "service"}`} className="text-slate-400 hover:text-red-600" onClick={() => { setRows((rs) => rs.filter((x) => x.id !== r.id)); setSaved(false); }}><i className="ti ti-trash" aria-hidden="true" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5">
        <ErrorLine text={error} />
        {saved ? <span className="text-[12px] text-[#27500A]">Saved. The invoice line dropdown uses this list.</span> : null}
        <button type="button" className={`${primaryCls} ml-auto`} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Section>
  );
}
