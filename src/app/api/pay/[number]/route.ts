import { NextResponse } from "next/server";
import { reportClientPayment } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";

/**
 * POST { t } from the customer's pay page: "I've sent the payment".
 * No account; the invoice's random token is the key, and a wrong token
 * answers the same as a missing invoice. Pressing twice changes nothing.
 */
export async function POST(req: Request, { params }: { params: Promise<{ number: string }> }): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { t?: unknown };
  const token = typeof body.t === "string" ? body.t.slice(0, 200) : "";
  try {
    const r = await reportClientPayment(decodeURIComponent((await params).number), token);
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return NextResponse.json({ error: msg }, { status: msg === "Invoice not found." ? 404 : 400 });
  }
}
