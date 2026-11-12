import "server-only";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";
import { requiresPaymentFirst } from "@/lib/billing/payment-gate";
import { loadFounderWireState } from "@/lib/billing/wire";
import type { SubscriptionRecord } from "@/lib/subscriptions/plans";

/**
 * True when this founder must pay before going any further. Fails open: if
 * online payment is not set up, or the wire lookup fails, nobody is locked out.
 * A founder who already has an open wire invoice is paying, so they are not held.
 */
export async function mustPayFirst(subscription: SubscriptionRecord, profileId: string): Promise<boolean> {
  if (!requiresPaymentFirst(subscription)) return false;
  if (!isPaymentsEnabled()) return false;
  try {
    const wire = await loadFounderWireState(profileId);
    if (wire.openInvoice) return false;
  } catch {
    return false;
  }
  return true;
}
