import { NextResponse } from "next/server";
import { accountingGuard, body, fail } from "@/lib/accounting/api";
import { listCustomers, saveCustomer } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";

/** GET: customers (add ?archived=1 to include archived). */
export async function GET(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    const includeArchived = new URL(req.url).searchParams.get("archived") === "1";
    return NextResponse.json({ customers: await listCustomers({ includeArchived }) });
  } catch (e) {
    return fail(e, 500);
  }
}

/** POST: create or (with id) update a customer. */
export async function POST(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    return NextResponse.json({ customer: await saveCustomer(await body(req), g.userId) });
  } catch (e) {
    return fail(e);
  }
}
