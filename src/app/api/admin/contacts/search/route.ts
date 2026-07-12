import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/contacts/search?q=… — recipient autocomplete over the shared CRM
// contacts (same source as Sales/IR). Returns up to 8 { name, email } matches.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ contacts: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createServiceRoleClient();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const { data } = await db
    .from("crm_contacts")
    .select("name, email")
    .not("email", "is", null)
    .or(`name.ilike.${like},email.ilike.${like}`)
    .order("name", { ascending: true, nullsFirst: false })
    .limit(8);

  const contacts = ((data ?? []) as Array<{ name: string | null; email: string | null }>)
    .filter((c) => c.email)
    .map((c) => ({ name: c.name ?? c.email!, email: c.email! }));
  return NextResponse.json({ contacts });
}
