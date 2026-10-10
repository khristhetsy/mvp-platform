import { NextResponse } from "next/server";
import { accountingGuard, body, fail } from "@/lib/accounting/api";
import { createInvoices } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST: one invoice, or a monthly series (repeat_count 2 to 36). send_now emails the first. */
export async function POST(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    return NextResponse.json(await createInvoices(await body(req), g.userId));
  } catch (e) {
    return fail(e);
  }
}
