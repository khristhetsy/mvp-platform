import { requirePermissionPage } from "@/lib/api/permissions";
import { listBank, openInvoicesForPicker } from "@/lib/accounting/server";
import { plaidConfigured } from "@/lib/accounting/plaid";
import { BankClient } from "@/components/admin/accounting/BankClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bank" };

export default async function AccountingBankPage({ searchParams }: Readonly<{ searchParams: Promise<{ tab?: string }> }>) {
  await requirePermissionPage("manage_billing");
  const sp = await searchParams;
  const tab = ["review", "matched", "categorized", "ignored", "all"].includes(sp.tab ?? "") ? (sp.tab as string) : "review";
  const [bank, openInvoices] = await Promise.all([listBank({ status: tab }), openInvoicesForPicker()]);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Bank</h1>
      <BankClient
        plaidReady={plaidConfigured()}
        items={bank.items.map((i) => ({ id: i.id, institution_name: i.institution_name, status: i.status, last_error: i.last_error, last_synced_at: i.last_synced_at }))}
        accounts={bank.accounts.map((a) => ({ id: a.id, item_id: a.item_id, name: a.name, mask: a.mask, current_balance_cents: a.current_balance_cents == null ? null : Number(a.current_balance_cents), available_balance_cents: a.available_balance_cents == null ? null : Number(a.available_balance_cents), balance_at: a.balance_at }))}
        transactions={bank.transactions}
        counts={bank.counts}
        openInvoices={openInvoices}
        tab={tab}
      />
    </div>
  );
}
