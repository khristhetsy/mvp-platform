import { NextResponse } from "next/server";

/**
 * Billing not active — payments handled manually.
 * Replace with a real payment processor when ready to charge.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Online checkout is not available yet. Please contact us to upgrade your plan." },
    { status: 503 }
  );
}
