import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Read-only dedupe check for a parsed LinkedIn import. Given a list of emails, returns
// the set that already exist in crm_contacts (lowercased match). NO writes — this only
// tells the triage screen which rows are new vs. already-known. Nothing is imported here.
const schema = z.object({
  emails: z.array(z.string()).max(20000),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const wanted = [...new Set(parsed.data.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (wanted.length === 0) return NextResponse.json({ existing: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const existing = new Set<string>();
  // Chunk the .in() lookups so the query string stays well under proxy URL limits.
  for (let i = 0; i < wanted.length; i += 500) {
    const chunk = wanted.slice(i, i + 500);
    const { data } = await db.from("crm_contacts").select("email").in("email", chunk);
    for (const r of (data ?? []) as Array<{ email: string | null }>) {
      if (r.email) existing.add(r.email.toLowerCase());
    }
  }

  return NextResponse.json({ existing: [...existing] });
}
