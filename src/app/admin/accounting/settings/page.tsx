import { requirePermissionPage } from "@/lib/api/permissions";
import { getPaymentInstructions } from "@/lib/accounting/server";
import { plaidConfig } from "@/lib/accounting/plaid";
import { SettingsClient } from "@/components/admin/accounting/SettingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounting settings" };

export default async function AccountingSettingsPage() {
  await requirePermissionPage("manage_billing");
  const [icg, ivg] = await Promise.all([getPaymentInstructions("icfo_capital_global"), getPaymentInstructions("icfo_venture_group")]);
  const cfg = plaidConfig();
  return (
    <div className="space-y-3 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
      <SettingsClient initial={{ icfo_capital_global: icg, icfo_venture_group: ivg }} plaidReady={Boolean(cfg)} plaidEnv={cfg?.env ?? null} />
    </div>
  );
}
