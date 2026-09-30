/**
 * One open Odoo activity, changed back in Odoo from the Matching tab's activity popover.
 *   PATCH { done: true } | { summary?, due? (YYYY-MM-DD) } → { ok }
 *   DELETE → { ok }  (cancels it, as Odoo's own Cancel does)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden } from "@/lib/ir/auth";
import { cancelOdooActivity, doneOdooActivity, editOdooActivity } from "@/lib/ir/odoo-open-activities";
import { odooConfigured } from "@/lib/crm-connectors/odoo/client";

export const dynamic = "force-dynamic";

const schema = z.object({ done: z.literal(true).optional(), summary: z.string().trim().max(300).optional(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() });
const idOf = async (ctx: { params: Promise<{ id: string }> }) => { const n = Number((await ctx.params).id); return Number.isInteger(n) && n > 0 ? n : null; };
const err = (e: unknown, fallback: string) => NextResponse.json({ error: e instanceof Error ? `Odoo: ${e.message}` : fallback }, { status: 502 });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  if (!odooConfigured()) return NextResponse.json({ error: "Odoo isn't connected." }, { status: 400 });
  const id = await idOf(ctx);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!id || !parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    if (parsed.data.done) await doneOdooActivity(id);
    else await editOdooActivity(id, { summary: parsed.data.summary, due: parsed.data.due });
    return NextResponse.json({ ok: true });
  } catch (e) { return err(e, "Couldn't update it in Odoo."); }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  if (!odooConfigured()) return NextResponse.json({ error: "Odoo isn't connected." }, { status: 400 });
  const id = await idOf(ctx);
  if (!id) return NextResponse.json({ error: "Invalid activity." }, { status: 400 });
  try { await cancelOdooActivity(id); return NextResponse.json({ ok: true }); }
  catch (e) { return err(e, "Couldn't cancel it in Odoo."); }
}
