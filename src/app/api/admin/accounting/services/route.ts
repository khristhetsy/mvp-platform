import { NextResponse } from "next/server";
import { accountingGuard, body, fail } from "@/lib/accounting/api";
import { addService, getServices, saveServices } from "@/lib/accounting/server";

export const dynamic = "force-dynamic";

/** GET: the saved services for invoice lines. */
export async function GET(): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  return NextResponse.json({ services: await getServices() });
}

/** PUT { services }: replace the whole list (Accounting › Settings › Services). */
export async function PUT(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    return NextResponse.json({ ok: true, services: await saveServices((await body(req)).services, g.userId) });
  } catch (e) {
    return fail(e);
  }
}

/** POST { name, unit_cents, entity }: add one ("Save as a new service" on an invoice line). */
export async function POST(req: Request): Promise<Response> {
  const g = await accountingGuard();
  if ("error" in g) return g.error;
  try {
    return NextResponse.json(await addService(await body(req), g.userId));
  } catch (e) {
    return fail(e);
  }
}
