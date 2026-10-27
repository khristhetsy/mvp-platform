import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ownerHasManagedIcfoPlan } from "@/lib/team/managed-icfo";
import { AccountManagerPicker } from "@/components/admin/AccountManagerPicker";

/** Shown on the admin company page for Premium, Done for you accounts only. */
export async function AccountManagerControl({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const premium = await ownerHasManagedIcfoPlan(createServiceRoleClient(), companyId);
  if (!premium) return null;
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <AccountManagerPicker companyId={companyId} canEdit={canEdit} />
      <p className="mt-1 text-xs text-slate-500">The account manager has Managed by iCFO access to this account. Billing stays with the Owner.</p>
    </div>
  );
}
