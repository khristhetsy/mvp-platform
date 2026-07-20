// COMPLIANCE: iCapOS pricing must never be transaction-based
// (success fees, % of raise, per-closed-investment). Transaction-based
// compensation triggers broker-dealer registration requirements.
// Do not add price types without securities counsel sign-off.
//
// This union makes prohibited price shapes UNREPRESENTABLE in the type system:
// there is intentionally no `percentage_of_raise`, `success_fee`, or
// `per_closed_deal` member. Any billing/plan config that carries a price type
// must type it as `PriceType` so a transaction-based value fails to compile.

export type PriceType = "flat_subscription" | "flat_listing_fee" | "flat_seat_fee";

export const ALLOWED_PRICE_TYPES: readonly PriceType[] = [
  "flat_subscription",
  "flat_listing_fee",
  "flat_seat_fee",
];

/** Runtime backstop for values arriving from outside the type system (DB, config, API). */
export function isAllowedPriceType(value: unknown): value is PriceType {
  return typeof value === "string" && (ALLOWED_PRICE_TYPES as readonly string[]).includes(value);
}

/** Throws if a non-flat (transaction-based) price type is encountered. */
export function assertAllowedPriceType(value: unknown): asserts value is PriceType {
  if (!isAllowedPriceType(value)) {
    throw new Error(
      `Disallowed price type "${String(value)}". iCapOS pricing must be flat (no success fees, % of raise, or per-deal charges).`,
    );
  }
}
