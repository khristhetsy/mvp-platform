"use client";

/** New or edit customer, with a lookup in the shared Contacts list to fill it in. */
import { useEffect, useState } from "react";
import { DEFAULT_BILLED_BY, ENTITIES, type Customer, type EntityId } from "@/lib/accounting/core";
import { ErrorLine, Field, Modal, api, btnCls, inputCls, primaryCls } from "@/components/admin/accounting/ui";

type Contact = { id: string; name: string | null; email: string | null; company: string | null; phone: string | null };

export function CustomerEditor({ initial, onClose, onSaved }: Readonly<{ initial?: Customer | null; onClose: () => void; onSaved: (c: Customer) => void }>) {
  const [f, setF] = useState({
    entity: (initial?.entity ?? DEFAULT_BILLED_BY) as EntityId,
    company: initial?.company ?? "",
    contact_name: initial?.contact_name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
    crm_contact_id: initial?.crm_contact_id ?? "",
    archived: initial?.archived ?? false,
  });
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Contact[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      const r = await api<{ contacts: Contact[] }>(`/api/admin/accounting/contacts?q=${encodeURIComponent(q)}`);
      setHits(r.ok ? r.data.contacts : []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  function pick(c: Contact) {
    setF({ ...f, contact_name: c.name ?? f.contact_name, company: c.company ?? f.company, email: c.email ?? f.email, phone: c.phone ?? f.phone, crm_contact_id: c.id });
    setQ("");
    setHits([]);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const r = await api<{ customer: Customer }>("/api/admin/accounting/customers", "POST", { ...f, id: initial?.id });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onSaved(r.data.customer);
  }

  return (
    <Modal
      title={initial ? "Edit customer" : "New customer"}
      onClose={onClose}
      footer={<><button type="button" className={btnCls} onClick={onClose}>Cancel</button><button type="button" className={primaryCls} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save customer"}</button></>}
    >
      {!initial ? (
        <div className="relative">
          <Field label="Fill in from Contacts" hint="Optional. Search the shared Contacts list by name, company or email.">
            <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nazneen Dewji" />
          </Field>
          {hits.length > 0 && q.trim().length >= 2 ? (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {hits.map((c) => (
                <button key={c.id} type="button" onClick={() => pick(c)} className="block w-full border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50">
                  <div className="text-[13px] font-medium text-slate-900">{c.name ?? c.email}</div>
                  <div className="text-[11.5px] text-slate-500">{[c.company, c.email].filter(Boolean).join(" · ")}</div>
                </button>
              ))}
            </div>
          ) : null}
          {f.crm_contact_id ? <p className="mt-1 text-[11.5px] text-[#27500A]">Linked to a contact in Contacts.</p> : null}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Company"><input className={inputCls} value={f.company} onChange={set("company")} placeholder="Cenna Biosciences" /></Field>
        <Field label="Contact name"><input className={inputCls} value={f.contact_name} onChange={set("contact_name")} placeholder="Nazneen Dewji" /></Field>
        <Field label="Email" hint="Invoices are sent here."><input className={inputCls} type="email" value={f.email} onChange={set("email")} placeholder="name@company.com" /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
      </div>
      <Field label="Billing address"><textarea className={inputCls} rows={2} value={f.address} onChange={set("address")} /></Field>
      <Field label="Billed by">
        <select className={inputCls} value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value as EntityId })}>
          {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea className={inputCls} rows={2} value={f.notes} onChange={set("notes")} /></Field>
      {initial ? (
        <label className="flex items-center gap-2 text-[12.5px] text-slate-600"><input type="checkbox" checked={f.archived} onChange={(e) => setF({ ...f, archived: e.target.checked })} /> Archived (hidden from new invoices)</label>
      ) : null}
      <ErrorLine text={error} />
    </Modal>
  );
}
