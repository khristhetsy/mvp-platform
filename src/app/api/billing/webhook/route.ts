import { NextResponse } from "next/server";

/**
 * Stripe webhook stub — no-op until billing is activated.
 */
export async function POST() {
  return NextResponse.json({ received: true });
}
