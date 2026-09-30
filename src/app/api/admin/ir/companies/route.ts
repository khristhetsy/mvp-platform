/**
 * Company search for linking an IR project to its iCapOS company.
 *   GET ?q=doyle → { companies: [{ id, name, published }] }  (up to 10, by name)
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().replace(/[%_,()]/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ companies: [] });
  try {
    const { data, error } = await db().from("companies").select("id, company_name, is_published").ilike("company_name", `%${q}%`).order("company_name").limit(10);
    if (error) throw new Error(error.message);
    return NextResponse.json({ companies: ((data ?? []) as Array<{ id: string; company_name: string | null; is_published: boolean | null }>).map((c) => ({ id: c.id, name: c.company_name ?? "Company", published: !!c.is_published })) });
  } catch (e) { return failed(e, "Couldn't search companies."); }
}
