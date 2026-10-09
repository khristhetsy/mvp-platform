import { NextResponse } from "next/server";
import { accountingGuard, fail } from "@/lib/accounting/api";
import { searchCrmContacts } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";

/** GET ?q=: shared CRM contacts to start a customer from. */
export async function GET(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    return NextResponse.json({ contacts: await searchCrmContacts(q) });
  } catch (e) {
    return fail(e, 500);
  }
}
