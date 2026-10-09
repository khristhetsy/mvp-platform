import { NextResponse } from "next/server";
import { accountingGuard, fail } from "@/lib/accounting/api";
import { disconnectBank } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";

/** DELETE: disconnect a bank (transactions already synced stay in the books). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    await disconnectBank((await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
