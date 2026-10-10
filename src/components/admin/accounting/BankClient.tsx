"use client";

/**
 * Accounting › Bank. Connect Bank of America through Plaid (read only), or
 * import a CSV / QFX download. Each transaction gets one decision: match a
 * deposit to an invoice, categorize it, or ignore it. Nothing is marked paid
 * without a person confirming.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OdooPager } from "@/components/admin/OdooPager";
import { ToolbarGear } from "@/components/admin/ToolbarGear";
import { OdooSearchBar, EMPTY_SEARCH, type SearchState } from "@/components/admin/OdooSearchBar";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { EXPENSE_CATEGORIES, fmtDate, fmtStampPT, money, type BankTxStatus } from "@/lib/accounting/core";
import { ErrorLine, Field, Modal, Tag, api, btnCls, inputCls, primaryCls } from "@/components/admin/accounting/ui";

export type BankItemView = { id: string; institution_name: string | null; status: string; last_error: string | null; last_synced_at: string | null };
export type BankAccountView = { id: string; item_id: string | null; name: string; mask: string | null; current_balance_cents: number | null; available_balance_cents: number | null; balance_at: string | null };
export type BankTxView = {
  id: string; account_id: string; posted_on: string; description: string; merchant: string | null; amount_cents: number; pending: boolean;
  status: BankTxStatus; category: string | null; accountName: string; source: "plaid" | "import";
  suggestion: { invoiceId: string; invoiceNumber: string; customer: string } | null; matchedNumber: string | null;
};
export type OpenInvoice = { id: string; invoice_number: string; customer: string; balance_cents: number; due_date: string };

type PlaidHandler = { open: () => void; destroy?: () => void };
type PlaidGlobal = { create: (cfg: { token: string; onSuccess: (publicToken: string, meta: { institution?: { name?: string } | null }) => void; onExit?: (err: unknown) => void }) => PlaidHandler };

function loadPlaid(): Promise<PlaidGlobal> {
  const w = window as unknown as { Plaid?: PlaidGlobal };
  if (w.Plaid) return Promise.resolve(w.Plaid);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    s.async = true;
    s.onload = () => (w.Plaid ? resolve(w.Plaid) : reject(new Error("Plaid didn't load.")));
    s.onerror = () => reject(new Error("Couldn't load Plaid. Check your connection and try again."));
    document.head.appendChild(s);
  });
}

const TABS: Array<{ key: BankTxStatus | "all"; label: string }> = [
  { key: "review", label: "To review" },
  { key: "matched", label: "Matched" },
  { key: "categorized", label: "Categorized" },
  { key: "ignored", label: "Ignored" },
  { key: "all", label: "All" },
];

export function BankClient({
  plaidReady, items, accounts, transactions, counts, openInvoices, tab,
}: Readonly<{
  plaidReady: boolean;
  items: BankItemView[];
  accounts: BankAccountView[];
  transactions: BankTxView[];
  counts: Record<string, number>;
  openInvoices: OpenInvoice[];
  tab: string;
}>) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importAccount, setImportAccount] = useState("");
  const [importName, setImportName] = useState("Bank of America checking");
  const [file, setFile] = useState<File | null>(null);
  const [picking, setPicking] = useState<BankTxView | null>(null);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);

  const fields: SearchField<BankTxView>[] = [
    { label: "description", get: (t) => t.description },
    { label: "date", get: (t) => fmtDate(t.posted_on) },
    { label: "amount", get: (t) => money(t.amount_cents) },
    { label: "account", get: (t) => t.accountName },
    { label: "category", get: (t) => t.category ?? t.matchedNumber },
  ];
  const found = matchRows(transactions, fields, search.q);

  async function connect(reconnectItemId?: string) {
    setError(null);
    setBusy("connect");
    const t = await api<{ link_token: string }>("/api/admin/accounting/bank", "POST", { action: "link_token", item_id: reconnectItemId });
    if (!t.ok) { setBusy(null); setError(t.error); return; }
    try {
      const Plaid = await loadPlaid();
      const handler = Plaid.create({
        token: t.data.link_token,
        onSuccess: async (publicToken, meta) => {
          setBusy("sync");
          const r = reconnectItemId
            ? await api<{ added: number }>("/api/admin/accounting/bank", "POST", { action: "reconnected", item_id: reconnectItemId })
            : await api<{ accounts: number; sync: { added: number } }>("/api/admin/accounting/bank", "POST", { action: "connect", public_token: publicToken, institution_name: meta?.institution?.name ?? null });
          setBusy(null);
          if (!r.ok) { setError(r.error); return; }
          setNotice(reconnectItemId ? "Bank reconnected and synced." : "Bank connected. Transactions are loading in; the first sync can take a few minutes to fill in history.");
          router.refresh();
        },
        onExit: () => setBusy(null),
      });
      handler.open();
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Couldn't open Plaid.");
    }
  }

  async function syncNow() {
    setBusy("sync");
    setError(null);
    const r = await api<{ added: number; updated: number; errors: string[] }>("/api/admin/accounting/bank", "POST", { action: "sync" });
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setNotice(r.data.errors.length ? `Sync finished with a problem: ${r.data.errors[0]}` : `Synced. ${r.data.added} new, ${r.data.updated} updated.`);
    router.refresh();
  }

  async function doImport() {
    if (!file) { setError("Choose a file first."); return; }
    setBusy("import");
    setError(null);
    const text = await file.text();
    const r = await api<{ imported: number; skipped: number }>("/api/admin/accounting/bank", "POST", { action: "import", text, account_id: importAccount || null, account_name: importName });
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setImportOpen(false);
    setFile(null);
    setNotice(`Imported ${r.data.imported} transaction${r.data.imported === 1 ? "" : "s"}${r.data.skipped ? `, skipped ${r.data.skipped} already here` : ""}.`);
    router.refresh();
  }

  async function decide(txId: string, payload: Record<string, unknown>, done: string) {
    setBusy(txId);
    setError(null);
    const r = await api(`/api/admin/accounting/bank/transactions/${txId}`, "POST", payload);
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setNotice(done);
    setPicking(null);
    router.refresh();
  }

  async function disconnect(itemId: string) {
    setBusy(itemId);
    const r = await api(`/api/admin/accounting/bank/items/${itemId}`, "DELETE");
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setNotice("Bank disconnected. Transactions already here stay in the books.");
    router.refresh();
  }

  const plaidAccounts = accounts.filter((a) => a.item_id);
  const importAccounts = accounts.filter((a) => !a.item_id);

  return (
    <div className="space-y-3">
      {items.length === 0 && plaidAccounts.length === 0 ? (
        <div className="rounded-xl bg-slate-50 px-4 py-6 text-center">
          <i className="ti ti-building-bank text-[24px] text-slate-600" aria-hidden="true" />
          <div className="mt-1 text-[15px] font-semibold text-slate-900">Connect your bank</div>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Sign in to Bank of America in Plaid&apos;s secure window. iCapOS never sees your password, and the connection is read only.</p>
          {plaidReady ? (
            <button type="button" className={`${primaryCls} mt-3`} disabled={busy !== null} onClick={() => connect()}><i className="ti ti-plug-connected" aria-hidden="true" />{busy === "connect" ? "Opening…" : "Connect Bank of America"}</button>
          ) : (
            <p className="mx-auto mt-3 max-w-md rounded-lg bg-[#FAEEDA] px-3 py-2 text-[12.5px] text-[#633806]">Plaid isn&apos;t set up yet. Add PLAID_CLIENT_ID and PLAID_SECRET in Vercel (Production) and redeploy, then this button appears.</p>
          )}
          <div className="mt-2"><button type="button" className="text-[12px] text-[#1A6CE4]" onClick={() => setImportOpen(true)}>Or import a Bank of America CSV or QFX file</button></div>
        </div>
      ) : null}

      {items.map((it) => {
        const accts = plaidAccounts.filter((a) => a.item_id === it.id);
        return (
          <div key={it.id} className="rounded-xl border border-slate-200 bg-white">
            {accts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 text-[13px] last:border-b-0">
                <i className="ti ti-building-bank text-[20px] text-slate-600" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">
                    {it.institution_name ?? "Bank"} · {a.name}{a.mask ? ` ••${a.mask}` : ""}{" "}
                    {it.status === "active" ? <Tag tone="ok">Connected via Plaid</Tag> : it.status === "needs_login" ? <Tag tone="warn">Sign in again</Tag> : <Tag tone="bad">Sync error</Tag>}
                  </div>
                  <div className="text-[12px] text-slate-500">
                    {a.current_balance_cents != null ? `Balance ${money(a.current_balance_cents)} · ` : ""}synced {fmtStampPT(it.last_synced_at)} · auto sync daily
                  </div>
                  {it.last_error && it.status !== "active" ? <div className="text-[12px] text-red-700">{it.last_error}</div> : null}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2.5">
              {it.status === "needs_login" ? <button type="button" className={primaryCls} disabled={busy !== null} onClick={() => connect(it.id)}><i className="ti ti-refresh" aria-hidden="true" />Reconnect</button> : null}
              <button type="button" className={btnCls} disabled={busy !== null} onClick={syncNow}><i className="ti ti-refresh" aria-hidden="true" />{busy === "sync" ? "Syncing…" : "Sync now"}</button>
              <button type="button" className={btnCls} disabled={busy !== null} onClick={() => disconnect(it.id)}><i className="ti ti-plug-connected-x" aria-hidden="true" />Disconnect</button>
            </div>
          </div>
        );
      })}

      {notice ? <p className="rounded-lg bg-[#EAF3DE] px-3 py-2 text-[12.5px] text-[#27500A]">{notice}</p> : null}
      <ErrorLine text={error} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <ToolbarGear
            items={[
              { key: "import", icon: "ti-file-import", label: "Import Bank of America file", hint: "CSV or QFX", onClick: () => setImportOpen(true) },
              ...(plaidReady && items.length > 0 ? [{ key: "connect", icon: "ti-plug-connected", label: "Connect another account", onClick: () => void connect() }] : []),
            ]}
          />
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => router.replace(`/admin/accounting/bank${t.key === "review" ? "" : `?tab=${t.key}`}`)}
                className={`rounded-md px-2.5 py-1 text-[12px] ${tab === t.key ? "bg-[#E6F1FB] font-medium text-[#0C447C]" : "text-slate-600 hover:bg-slate-50"}`}>
                {t.label}{t.key !== "all" ? ` ${counts[t.key] ?? 0}` : ""}
              </button>
            ))}
          </div>
          <div className="min-w-[200px] flex-1">
            <OdooSearchBar scope="accounting-bank" state={search} onChange={setSearch} quick={[]} fields={[]} groups={[]} placeholder="Search description, date, amount, account" applyDefault={false} width="100%" />
          </div>
          <OdooPager className="ml-auto" label={`${found.rows.length === 0 ? 0 : 1}-${found.rows.length} / ${found.rows.length}`} prev={{ disabled: true }} next={{ disabled: true }} />
        </div>
        <div className="px-3 pt-2"><SearchCount result={found} noun="transactions" /></div>
        {transactions.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">{tab === "review" ? "Nothing to review. New transactions arrive every morning." : "No transactions here."}</p>
        ) : found.rows.length === 0 ? (
          <div className="p-3"><NoSearchMatches query={search.q} fields={fields.map((f) => f.label)} onClear={() => setSearch({ ...search, q: "" })} /></div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-medium text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">{tab === "review" ? "Decide" : "Result"}</th>
              </tr>
            </thead>
            <tbody>
              {found.rows.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600"><Highlight text={fmtDate(t.posted_on)} query={search.q} /></td>
                  <td className="px-2 py-2">
                    <div className="text-slate-800"><Highlight text={t.description} query={search.q} /></div>
                    <div className="text-[11.5px] text-slate-500"><Highlight text={t.accountName} query={search.q} />{t.pending ? " · pending" : ""}{t.source === "import" ? " · imported" : ""}</div>
                  </td>
                  <td className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${t.amount_cents > 0 ? "text-[#27500A]" : "text-slate-800"}`}>{t.amount_cents > 0 ? "+" : ""}{money(t.amount_cents)}</td>
                  <td className="px-3 py-2 text-right">
                    {t.status === "review" ? (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {t.suggestion ? <SuggestButton tx={t} sug={t.suggestion} disabled={busy !== null} onMatch={decide} /> : null}
                        {t.amount_cents > 0 && openInvoices.length ? <button type="button" className={btnCls} disabled={busy !== null} onClick={() => setPicking(t)}>{t.suggestion ? "Other invoice" : "Find invoice"}</button> : null}
                        <select aria-label="Category" className={`${inputCls} w-auto py-1 text-[12px]`} value="" disabled={busy !== null}
                          onChange={(e) => e.target.value && decide(t.id, { action: "categorize", category: e.target.value }, `Categorized as ${e.target.value}.`)}>
                          <option value="">Categorize</option>
                          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" className="text-[12px] text-slate-500 hover:text-slate-800" disabled={busy !== null} onClick={() => decide(t.id, { action: "ignore" }, "Ignored.")}>Ignore</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {t.status === "matched" ? <Tag tone="ok">Paid {t.matchedNumber ?? "invoice"}</Tag> : t.status === "categorized" ? <Tag tone="info">{t.category}</Tag> : <Tag tone="mute">Ignored</Tag>}
                        {t.status !== "matched" ? <button type="button" className="text-[12px] text-slate-500 hover:text-slate-800" disabled={busy !== null} onClick={() => decide(t.id, { action: "reset" }, "Back in review.")}>Undo</button> : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {picking ? (
        <Modal title={`Which invoice does ${money(picking.amount_cents)} pay?`} onClose={() => setPicking(null)}>
          <p className="text-[12.5px] text-slate-500">{fmtDate(picking.posted_on)} · {picking.description}</p>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            {openInvoices.map((i) => (
              <button key={i.id} type="button" disabled={busy !== null} onClick={() => decide(picking.id, { action: "match", invoice_id: i.id }, `Matched to ${i.invoice_number}. Payment recorded.`)}
                className="flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2 text-left text-[13px] hover:bg-slate-50">
                <div className="min-w-0 flex-1"><div className="font-medium text-slate-900">{i.invoice_number}</div><div className="text-[11.5px] text-slate-500">{i.customer} · due {fmtDate(i.due_date)}</div></div>
                <span className={`tabular-nums ${i.balance_cents === picking.amount_cents ? "font-semibold text-[#27500A]" : "text-slate-700"}`}>{money(i.balance_cents)}</span>
              </button>
            ))}
          </div>
          <p className="text-[11.5px] text-slate-500">A deposit larger than the balance records only the balance due.</p>
          <ErrorLine text={error} />
        </Modal>
      ) : null}

      {importOpen ? (
        <Modal
          title="Import a Bank of America file"
          onClose={() => setImportOpen(false)}
          footer={<><button type="button" className={btnCls} onClick={() => setImportOpen(false)}>Cancel</button><button type="button" className={primaryCls} disabled={busy !== null} onClick={doImport}>{busy === "import" ? "Importing…" : "Import"}</button></>}
        >
          <p className="text-[12.5px] text-slate-600">In Bank of America online banking, open the account, choose Download, and pick Microsoft Excel (CSV) or Quicken (QFX). Importing the same file twice adds nothing new.</p>
          <Field label="File"><input type="file" accept=".csv,.qfx,.ofx,text/csv" className="text-[13px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <Field label="Into account">
            <select className={inputCls} value={importAccount} onChange={(e) => setImportAccount(e.target.value)}>
              <option value="">A new imported account</option>
              {importAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          {!importAccount ? <Field label="Account name"><input className={inputCls} value={importName} onChange={(e) => setImportName(e.target.value)} /></Field> : null}
          <ErrorLine text={error} />
        </Modal>
      ) : null}
    </div>
  );
}

function SuggestButton({ tx, sug, disabled, onMatch }: Readonly<{
  tx: BankTxView;
  sug: NonNullable<BankTxView["suggestion"]>;
  disabled: boolean;
  onMatch: (txId: string, payload: Record<string, unknown>, done: string) => void;
}>) {
  return (
    <button type="button" className={primaryCls} disabled={disabled} onClick={() => onMatch(tx.id, { action: "match", invoice_id: sug.invoiceId }, `Matched to ${sug.invoiceNumber}. Payment recorded.`)}>
      <i className="ti ti-check" aria-hidden="true" />Match {sug.invoiceNumber}
    </button>
  );
}
