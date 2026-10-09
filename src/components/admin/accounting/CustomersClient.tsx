"use client";

/** Accounting › Customers: who you bill, with open balances. Same list toolbar as every admin list. */
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { OdooPager } from "@/components/admin/OdooPager";
import { NewButton, ToolbarGear, downloadCsv } from "@/components/admin/ToolbarGear";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { entityName, money, type Customer } from "@/lib/accounting/core";
import { CustomerEditor } from "@/components/admin/accounting/CustomerEditor";
import { Tag } from "@/components/admin/accounting/ui";

export type CustomerRow = Customer & { openCents: number; overdueCents: number; invoiceCount: number };

const QUICK = [
  { key: "open", label: "Has open balance" },
  { key: "overdue", label: "Overdue" },
  { key: "archived", label: "Archived", sep: true },
];

export function CustomersClient({ rows }: Readonly<{ rows: CustomerRow[] }>) {
  const router = useRouter();
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [editing, setEditing] = useState<Customer | null | "new">(null);

  const fields: SearchField<CustomerRow>[] = [
    { label: "company", get: (r) => r.company },
    { label: "contact", get: (r) => r.contact_name },
    { label: "email", get: (r) => r.email },
    { label: "billed by", get: (r) => entityName(r.entity) },
  ];
  const q = search.quick;
  const filtered = rows.filter((r) => (q.includes("archived") ? r.archived : !r.archived) && (!q.includes("open") || r.openCents > 0) && (!q.includes("overdue") || r.overdueCents > 0));
  const found = matchRows(filtered, fields, search.q);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <NewButton onClick={() => setEditing("new")} />
        <ToolbarGear items={[{ key: "export", icon: "ti-download", label: "Export customers", onClick: () => downloadCsv("customers.csv", ["company", "contact", "email", "phone", "billed_by", "open", "overdue"], found.rows.map((r) => [r.company, r.contact_name, r.email, r.phone, entityName(r.entity), (r.openCents / 100).toFixed(2), (r.overdueCents / 100).toFixed(2)])) }]} />
        <div className="min-w-[240px] flex-1">
          <OdooSearchBar scope="accounting-customers" state={search} onChange={setSearch} quick={QUICK} fields={[]} groups={[]} placeholder="Search company, contact, email" applyDefault={false} width="100%" />
        </div>
        <OdooPager className="ml-auto" label={`${found.rows.length === 0 ? 0 : 1}-${found.rows.length} / ${found.rows.length}`} prev={{ disabled: true }} next={{ disabled: true }} />
      </div>
      <div className="px-3 pt-2"><SearchCount result={found} noun="customers" /></div>
      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">Add your first customer</p>
          <p className="mt-1 text-[12.5px] text-slate-500">Start from someone in Contacts or type their details.</p>
        </div>
      ) : found.rows.length === 0 && found.active ? (
        <div className="p-3"><NoSearchMatches query={search.q} fields={fields.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} /></div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-medium text-slate-500">
              <th className="px-3 py-2">Company</th>
              <th className="px-2 py-2">Contact</th>
              <th className="hidden px-2 py-2 md:table-cell">Billed by</th>
              <th className="px-2 py-2 text-right">Open</th>
              <th className="hidden px-2 py-2 text-right md:table-cell">Invoices</th>
              <th className="w-32 px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {found.rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">
                  <button type="button" className="text-left hover:text-[#1A6CE4]" onClick={() => setEditing(r)}><Highlight text={r.company || r.contact_name} query={search.q} /></button>
                  {r.crm_contact_id ? <span className="ml-2"><Tag tone="info">In Contacts</Tag></span> : null}
                </td>
                <td className="px-2 py-2 text-slate-700">
                  <Highlight text={r.contact_name ?? ""} query={search.q} />
                  <div className="text-[11.5px] text-slate-500"><Highlight text={r.email ?? "No email"} query={search.q} /></div>
                </td>
                <td className="hidden px-2 py-2 text-slate-600 md:table-cell"><Highlight text={entityName(r.entity)} query={search.q} /></td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {money(r.openCents)}
                  {r.overdueCents > 0 ? <div className="text-[11.5px] text-red-700">{money(r.overdueCents)} overdue</div> : null}
                </td>
                <td className="hidden px-2 py-2 text-right text-slate-600 md:table-cell">{r.invoiceCount}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/accounting/invoices/new?customer=${r.id}`} className="text-[12.5px] font-medium text-[#1A6CE4]">New invoice</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing ? (
        <CustomerEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      ) : null}
    </div>
  );
}
