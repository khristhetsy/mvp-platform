/**
 * POST /api/sales/contacts/linkedin-import — LinkedIn Connections.csv into Contacts.
 *
 *   { mode: "match", rows: [{ i, slug, email?, name }] }            ≤ 1,000 rows per call
 *     → { matches: [{ idx, kind, contact_id, contact_name, contact_company }] }
 *     Every contact that could be the same person: same LinkedIn profile, same email, same name.
 *
 *   { mode: "commit", fileName?, rows: [{ …connection, action, targetId? }] }   ≤ 1,000 rows per call
 *     action "new"   → insert as source "linkedin" (external_id = profile slug, so a re-run never
 *                       inserts twice). A same profile or same email found at commit time merges
 *                       instead, in case Contacts changed since the match step.
 *     action "merge" → fill blanks on targetId (never overwrites a value).
 *     action "skip"  → nothing.
 *     → { created, merged, skipped }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getSalesScope } from "@/lib/sales/scope";
import { decideMatch, type MatchCandidate } from "@/lib/contacts/linkedin-import";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const matchSchema = z.object({
  mode: z.literal("match"),
  rows: z.array(z.object({
    i: z.number().int().min(0),
    slug: z.string().max(200),
    email: z.string().max(200).nullable().optional(),
    name: z.string().max(300),
  })).min(1).max(1000),
});

const connection = z.object({
  slug: z.string().min(1).max(200),
  url: z.string().max(500),
  firstName: z.string().max(150),
  lastName: z.string().max(150),
  name: z.string().min(1).max(300),
  email: z.string().max(200).nullable(),
  company: z.string().max(300).nullable(),
  position: z.string().max(500).nullable(),
  connectedOn: z.string().max(40).nullable(),
  group: z.enum(["investor", "founder", "other"]),
  action: z.enum(["new", "merge", "skip"]),
  targetId: z.string().uuid().nullable().optional(),
});
const commitSchema = z.object({
  mode: z.literal("commit"),
  fileName: z.string().max(200).optional(),
  rows: z.array(connection).min(1).max(1000),
});
type Conn = z.infer<typeof connection>;
type MatchRow = { idx: number; kind: "linkedin" | "email" | "name"; contact_id: string; contact_name: string | null; contact_company: string | null };

function liBlock(c: Conn) {
  return { url: c.url, slug: c.slug, first_name: c.firstName, last_name: c.lastName, position: c.position, connected_on: c.connectedOn, group: c.group, imported_at: new Date().toISOString() };
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  const m = matchSchema.safeParse(body);
  if (m.success) {
    const { data, error } = await db.rpc("linkedin_import_match", { p_rows: m.data.rows });
    if (error) return NextResponse.json({ error: error.message.includes("linkedin_import_match") ? "The LinkedIn import migration hasn't been run yet." : error.message }, { status: 500 });
    return NextResponse.json({ matches: (Array.isArray(data) ? data : []) as MatchRow[] });
  }

  const c = commitSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: "Send up to 1,000 connections per request." }, { status: 400 });
  const rows = c.data.rows;

  // Re-check "new" rows against the book: a same profile or same email found now merges instead.
  const fresh = rows.map((r, i) => ({ r, i })).filter((x) => x.r.action === "new");
  const recheck = new Map<number, string>();
  if (fresh.length) {
    const { data, error } = await db.rpc("linkedin_import_match", { p_rows: fresh.map((x) => ({ i: x.i, slug: x.r.slug, email: x.r.email, name: "" })) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const byIdx = new Map<number, MatchCandidate[]>();
    for (const mr of (Array.isArray(data) ? data : []) as MatchRow[]) {
      const list = byIdx.get(mr.idx) ?? [];
      list.push({ kind: mr.kind, id: mr.contact_id, name: mr.contact_name, company: mr.contact_company });
      byIdx.set(mr.idx, list);
    }
    for (const [idx, cands] of byIdx) {
      const d = decideMatch(cands);
      if (d.defaultTarget && (d.kind === "linkedin" || d.kind === "email")) recheck.set(idx, d.defaultTarget);
    }
  }

  const merges: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  let skipped = 0;
  const scope = await getSalesScope(profile);
  const at = new Date().toISOString();

  rows.forEach((r, i) => {
    const target = r.action === "merge" ? r.targetId ?? null : recheck.get(i) ?? null;
    if (r.action === "skip" || (r.action === "merge" && !target)) { skipped++; return; }
    if (target) {
      merges.push({ id: target, slug: r.slug, email: r.email, company: r.company, position: r.position, li: liBlock(r) });
      return;
    }
    inserts.push({
      source: "linkedin",
      external_id: r.slug,
      linkedin_slug: r.slug,
      name: r.name,
      email: r.email,
      email_source: r.email ? "given" : null,
      email_status: r.email ? "unverified" : null,
      company: r.company,
      enrichment_status: r.company ? "pending" : "no_website",
      tags: ["LinkedIn"],
      // Lead source drives the Contacts "Lead source" filter, so the shared
      // "LinkedIn without email" favorite can find every imported connection.
      overrides: { lead_source: "LinkedIn" },
      raw: {
        function: r.position,
        linkedin: liBlock(r),
        __profile: { extra: { LinkedIn: r.url } },
        import: { source: "linkedin", file: c.data.fileName ?? null, at },
      },
      owner_id: profile.id,
      assignee_ids: scope.isManager ? [] : [profile.id],
    });
  });

  // Merge targets dedupe: two connections pointing at one contact merge once (first wins).
  const seenTarget = new Set<string>();
  const mergeRows = merges.filter((x) => { const id = String(x.id); if (seenTarget.has(id)) { skipped++; return false; } seenTarget.add(id); return true; });

  let merged = 0;
  if (mergeRows.length) {
    const { data, error } = await db.rpc("linkedin_import_merge", { p_rows: mergeRows });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    merged = Number(data ?? 0);
  }

  let created = 0;
  for (let k = 0; k < inserts.length; k += 250) {
    const part = inserts.slice(k, k + 250);
    const { data, error } = await db.from("crm_contacts").upsert(part, { onConflict: "source,external_id", ignoreDuplicates: true }).select("id");
    if (error) return NextResponse.json({ error: error.message, created, merged, skipped }, { status: 500 });
    created += (data ?? []).length;
  }
  skipped += inserts.length - created; // already imported on an earlier run

  return NextResponse.json({ created, merged, skipped });
}
