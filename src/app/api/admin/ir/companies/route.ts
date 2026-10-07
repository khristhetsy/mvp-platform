/**
 * Company search for linking an IR project to its founder.
 *   GET ?q=liviq → {
 *     companies: [{ id, name, published }]                      iCapOS founder accounts (up to 10)
 *     contacts:  [{ id, name, company, email, answers }]        founders imported from Odoo (up to 8),
 *   }                                                          most questionnaire answers first
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";
import { questionnaireAnswers } from "@/lib/ir/founder-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().replace(/[%_,()]/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ companies: [], contacts: [] });
  try {
    const [co, ct] = await Promise.all([
      db().from("companies").select("id, company_name, is_published").ilike("company_name", `%${q}%`).order("company_name").limit(10),
      db().from("crm_contacts").select("id, name, company, email, extra:raw->__profile->extra").or(`company.ilike.%${q}%,name.ilike.%${q}%`).limit(25),
    ]);
    if (co.error) throw new Error(co.error.message);
    if (ct.error) throw new Error(ct.error.message);
    const companies = ((co.data ?? []) as Array<{ id: string; company_name: string | null; is_published: boolean | null }>).map((c) => ({ id: c.id, name: c.company_name ?? "Company", published: !!c.is_published }));
    const contacts = ((ct.data ?? []) as Array<{ id: string; name: string | null; company: string | null; email: string | null; extra: unknown }>)
      .map((c) => ({ id: c.id, name: c.name ?? c.email ?? "Contact", company: c.company && c.company !== c.email ? c.company : null, email: c.email, answers: questionnaireAnswers(c.extra) }))
      .sort((a, b) => b.answers - a.answers || (a.company ?? a.name).localeCompare(b.company ?? b.name))
      .slice(0, 8);
    return NextResponse.json({ companies, contacts });
  } catch (e) { return failed(e, "Couldn't search companies."); }
}
