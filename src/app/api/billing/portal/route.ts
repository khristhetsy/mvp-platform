import { NextResponse } from "next/server";

/**
 * Billing not active — no customer portal available yet.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Billing portal is not available yet. Please contact us for plan changes." },
    { status: 503 }
  );
}
