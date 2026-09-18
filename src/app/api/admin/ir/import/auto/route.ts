/**
 * One-click Odoo import.
 *   GET                                  → { configured, companies: AutoCompany[] }
 *   POST { key, createMissing? }         → AutoResult
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { autoCompanies, autoImport } from "@/lib/ir/odoo-auto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  try { return NextResponse.json(await autoCompanies()); } catch (e) { return failed(e, "Couldn't read from Odoo."); }
}

const schema = z.object({ key: z.string().min(1).max(200), createMissing: z.boolean().optional() });

export async function POST(req: NextRequest): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const p = schema.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Pick a company." }, { status: 400 });
  try { return NextResponse.json(await autoImport(p.data.key, me.id, { createMissing: p.data.createMissing })); } catch (e) { return failed(e, "Import failed."); }
}
