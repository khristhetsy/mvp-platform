import { canOfferActOnBehalf } from "@/lib/admin/act-on-behalf";
import { OpenAsFounderButton } from "@/components/admin/OpenAsFounderButton";

/**
 * "Open as founder" for staff who may act on this founder: the act_on_behalf permission,
 * or Managed by iCFO on this account. Renders nothing otherwise, and nothing while the
 * central switch is off, so the button is never shown when it could not work.
 */
export async function OpenAsFounderControl({ founderId, founderName }: { founderId: string | null; founderName: string | null }) {
  if (!founderId) return null;
  if (!(await canOfferActOnBehalf(founderId))) return null;
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="mb-2 text-xs text-slate-600">
        Run this account as the founder. Billing, team changes, account deletion and sending email as the founder stay blocked. Everything you do is logged under your name.
      </p>
      <OpenAsFounderButton founderId={founderId} founderName={founderName ?? "founder"} />
    </div>
  );
}
