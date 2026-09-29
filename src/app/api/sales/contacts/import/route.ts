/**
 * POST /api/sales/contacts/import — CSV import from the Contacts gear menu.
 *   { mode: "preview" | "commit", rows: [{ name, email?, company?, phone?, type? }] }
 * Preview de-dups against existing emails and reports what would be created; commit
 * inserts the new ones as source='manual' (same shape as the single Add contact).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getSalesScope } from "@/lib/sales/scope";
import { chunk } from "@/lib/supabase/paged";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const rowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(60).optional(),
  type: z.enum(["founder", "investor", "advisor", "other"]).optional(),
});
const schema = z.object({ mode: z.enum(["preview", "commit"]), rows: z.array(rowSchema).min(1).max(5000) });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Each row needs at least a name; up to 5,000 rows." }, { status: 400 });
  const { mode, rows } = parsed.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  // De-dup: by email within the file, then against contacts already in the book.
  const seen = new Set<string>();
  let dupInFile = 0;
  const unique = rows.filter((r) => {
    const key = r.email?.toLowerCase();
    if (!key) return true;
    if (seen.has(key)) { dupInFile++; return false; }
    seen.add(key); return true;
  });
  const existing = new Set<string>();
  for (const part of chunk([...seen])) {
    const { data } = await db.from("crm_contacts").select("email").in("email", part);
    for (const r of (data ?? []) as Array<{ email: string | null }>) if (r.email) existing.add(r.email.toLowerCase());
  }
  const toCreate = unique.filter((r) => !(r.email && existing.has(r.email.toLowerCase())));
  const summary = { total: rows.length, toCreate: toCreate.length, skippedDupInFile: dupInFile, skippedExisting: unique.length - toCreate.length, sample: toCreate.slice(0, 5).map((r) => ({ name: r.name, email: r.email ?? "", company: r.company ?? "" })) };
  if (mode === "preview") return NextResponse.json(summary);

  const scope = await getSalesScope(profile);
  let created = 0;
  for (const part of chunk(toCreate)) {
    const { error, data } = await db.from("crm_contacts").insert(part.map((r) => ({
      name: r.name, email: r.email || null, company: r.company || null, phone: r.phone || null,
      contact_type: r.type ?? null, source: "manual",
      external_id: r.email?.toLowerCase() || `manual:${crypto.randomUUID()}`,
      owner_id: profile.id, assignee_ids: scope.isManager ? [] : [profile.id],
    }))).select("id");
    if (!error) created += (data ?? []).length;
  }
  return NextResponse.json({ ...summary, created });
}
