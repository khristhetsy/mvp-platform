"use client";

/**
 * Accounting › Invoices. Same toolbar as every admin list: New, gear, Odoo
 * search bar, pager, row checkboxes with the selection bar. The list is small
 * enough to filter in the browser.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { OdooPager } from "@/components/admin/OdooPager";
import { NewButton, ToolbarGear, downloadCsv } from "@/components/admin/ToolbarGear";
import { SelectionBar, ActionResult } from "@/components/admin/sales/SelectionBar";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { balanceDue, displayStatus, entityName, fmtDate, money, todayPT, type DisplayStatus, type Invoice } from "@/lib/accounting/core";
import { StatusTag, api } from "@/components/admin/accounting/ui";

export type InvoiceRow = Invoice & { customerName: string; customerEmail: string | null };

const QUICK: Array<{ key: DisplayStatus; label: string; sep?: boolean }> = [
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "sent", label: "Sent" },
  { key: "partial", label: "Partly paid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid", sep: true },
  { key: "void", label: "Void" },
];
const PAGE = 80;

export function InvoicesListClient({ rows }: Readonly<{ rows: InvoiceRow[] }>) {
  const router = useRouter();
  const today = todayPT();
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const withStatus = useMemo(() => rows.map((r) => ({ ...r, shown: displayStatus(r, today) })), [rows, today]);
  const fields: SearchField<(typeof withStatus)[number]>[] = [
    { label: "number", get: (r) => r.invoice_number },
    { label: "customer", get: (r) => r.customerName },
    { label: "email", get: (r) => r.customerEmail },
    { label: "date", get: (r) => fmtDate(r.issue_date) },
    { label: "due", get: (r) => fmtDate(r.due_date) },
    { label: "amount", get: (r) => money(r.total_cents) },
    { label: "company", get: (r) => entityName(r.entity) },
  ];
  const byStatus = search.quick.length ? withStatus.filter((r) => search.quick.includes(r.shown)) : withStatus;
  const entityFilter = search.fields.company?.[0];
  const byEntity = entityFilter ? byStatus.filter((r) => entityName(r.entity) === entityFilter) : byStatus;
  const found = matchRows(byEntity, fields, search.q);
  const from = found.rows.length === 0 ? 0 : (page - 1) * PAGE + 1;
  const to = Math.min(found.rows.length, page * PAGE);
  const visible = found.rows.slice(from ? from - 1 : 0, to);

  const sum = (pred: (r: (typeof withStatus)[number]) => boolean) => withStatus.filter(pred).reduce((t, r) => t + balanceDue(r), 0);
  const tiles = [
    { label: "Draft", value: withStatus.filter((r) => r.shown === "draft").length.toString(), sub: "not sent" },
    { label: "Scheduled", value: money(withStatus.filter((r) => r.shown === "scheduled").reduce((t, r) => t + r.total_cents, 0)), sub: "send on their dates" },
    { label: "Open, not due", value: money(sum((r) => r.shown === "sent" || r.shown === "partial")), sub: "awaiting payment" },
    { label: "Overdue", value: money(sum((r) => r.shown === "overdue")), sub: "past due date", bad: true },
  ];

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function sendSelected() {
    const drafts = withStatus.filter((r) => selected.has(r.id) && (r.status === "draft" || r.status === "scheduled"));
    if (drafts.length === 0) { setResult("Only draft or scheduled invoices can be sent from here."); return; }
    setBusy(true);
    let ok = 0;
    const errors: string[] = [];
    for (const d of drafts) {
      const r = await api(`/api/admin/accounting/invoices/${d.id}`, "POST", { action: "send" });
      if (r.ok) ok++; else errors.push(`${d.invoice_number}: ${r.error}`);
    }
    setBusy(false);
    setSelected(new Set());
    setResult([`${ok} invoice${ok === 1 ? "" : "s"} sent.`, ...errors].join(" "));
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <NewButton href="/admin/accounting/invoices/new" />
        <ToolbarGear
          items={[
            {
              key: "export", icon: "ti-download", label: "Export these invoices",
              onClick: () => downloadCsv("invoices.csv",
                ["number", "company", "customer", "issued", "due", "total", "paid", "balance", "status"],
                found.rows.map((r) => [r.invoice_number, entityName(r.entity), r.customerName, r.issue_date, r.due_date, (r.total_cents / 100).toFixed(2), (r.amount_paid_cents / 100).toFixed(2), (balanceDue(r) / 100).toFixed(2), r.shown])),
            },
            { key: "settings", icon: "ti-settings", label: "Bank details on invoices", onClick: () => router.push("/admin/accounting/settings") },
          ]}
        />
        <div className="min-w-[240px] flex-1">
          <OdooSearchBar
            scope="accounting-invoices"
            state={search}
            onChange={(s) => { setSearch(s); setPage(1); setSelected(new Set()); }}
            quick={QUICK}
            fields={[{ key: "company", label: "Company", options: ["iCFO Capital Global, Inc.", "iCFO Venture Group"] }]}
            groups={[]}
            placeholder="Search number, customer, email, date, amount"
            applyDefault={false}
            width="100%"
          />
        </div>
        <OdooPager
          className="ml-auto"
          label={found.rows.length === 0 ? "0 / 0" : `${from}-${to} / ${found.rows.length}`}
          prev={{ onClick: page > 1 ? () => setPage(page - 1) : undefined, disabled: page <= 1 }}
          next={{ onClick: to < found.rows.length ? () => setPage(page + 1) : undefined, disabled: to >= found.rows.length }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-2.5 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">{t.label} · {t.sub}</div>
            <div className={`text-[16px] font-semibold tabular-nums ${t.bad && t.value !== "$0.00" ? "text-red-700" : "text-slate-900"}`}>{t.value}</div>
          </div>
        ))}
      </div>

      <SelectionBar
        count={selected.size}
        total={visible.length}
        onSelectAll={() => setSelected(new Set(visible.map((r) => r.id)))}
        onClear={() => setSelected(new Set())}
        busy={busy}
        actions={[{ key: "send", icon: "ti-send", label: "Send drafts", run: () => void sendSelected() }]}
      />
      <ActionResult text={result} onClose={() => setResult(null)} />
      <div className="px-3 pb-1"><SearchCount result={found} noun="invoices" /></div>

      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">Create your first invoice</p>
          <p className="mt-1 text-[12.5px] text-slate-500">Invoices go out by email with a PDF and your bank transfer details.</p>
          <Link href="/admin/accounting/invoices/new" className="mt-3 inline-block rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-[12.5px] font-medium text-white">New invoice</Link>
        </div>
      ) : found.rows.length === 0 && found.active ? (
        <div className="p-3"><NoSearchMatches query={search.q} fields={fields.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} /></div>
      ) : found.rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">No invoices with these filters.</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-medium text-slate-500">
              <th className="w-9 px-3 py-2"><input type="checkbox" aria-label="Select page" checked={visible.length > 0 && visible.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => r.id)) : new Set())} /></th>
              <th className="px-2 py-2">Number</th>
              <th className="px-2 py-2">Customer</th>
              <th className="hidden px-2 py-2 md:table-cell">Date</th>
              <th className="hidden px-2 py-2 md:table-cell">Due</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="hidden px-2 py-2 text-right lg:table-cell">Balance</th>
              <th className="px-2 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50" onClick={() => router.push(`/admin/accounting/invoices/${r.id}`)}>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.invoice_number}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="px-2 py-2 font-medium text-slate-900">
                  <Link href={`/admin/accounting/invoices/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-[#1A6CE4]"><Highlight text={r.invoice_number} query={search.q} /></Link>
                  {r.series_count ? <span className="ml-1.5 text-[11px] text-slate-500">{r.series_index} of {r.series_count}</span> : null}
                </td>
                <td className="px-2 py-2 text-slate-700"><Highlight text={r.customerName} query={search.q} /></td>
                <td className="hidden px-2 py-2 text-slate-600 md:table-cell"><Highlight text={fmtDate(r.issue_date)} query={search.q} /></td>
                <td className="hidden px-2 py-2 text-slate-600 md:table-cell"><Highlight text={fmtDate(r.due_date)} query={search.q} /></td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-900"><Highlight text={money(r.total_cents)} query={search.q} /></td>
                <td className="hidden px-2 py-2 text-right tabular-nums text-slate-600 lg:table-cell">{money(balanceDue(r))}</td>
                <td className="px-2 py-2 text-right"><StatusTag status={r.shown} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
