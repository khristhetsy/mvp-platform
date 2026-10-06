/**
 * POST /api/sales/contacts/import — file import from the Contacts gear menu.
 *
 * Mapped import (CSV or Excel, after the field mapping review):
 *   { mode: "preview" | "commit", source: "csv" | "xlsx", fileName?, columns, rows, mapping, decided, remember? }
 *   Every column must be mapped, sent to a custom field, or skipped before anything is
 *   written. Values are stored as received; custom values go to raw.__profile.extra by
 *   label (shown under Details on the profile), and the whole original row is kept in
 *   raw.import.row. "remember" saves the decisions for the next import from that source.
 *
 * Legacy shape (still accepted): { mode, rows: [{ name, email?, company?, phone?, type? }] }
 *
 * Preview de-dups against existing emails and reports what would be created; commit
 * inserts the new ones as source='manual' (same shape as the single Add contact).
 *
 * Provenance (contact finder spec 5.4/5.5): a commit must say where the list came
 * from (`sourceNote`) and its lawful basis (`lawfulBasis`); both are stored on every
 * contact it creates, so an access request can be answered and retention applied.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getSalesScope } from "@/lib/sales/scope";
import { chunk } from "@/lib/supabase/paged";
import { applyMapping, validateMapping } from "@/lib/contacts/field-mapping";
import { columnMappingSchema, mappingSourceSchema } from "@/lib/contacts/field-mapping-schema";
import { ensureCustomFields, loadCustomFields, saveMappings } from "@/lib/contacts/field-mapping-store";
import { LAWFUL_BASES } from "@/lib/verify/retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const rowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(60).optional(),
  type: z.enum(["founder", "investor", "advisor", "other"]).optional(),
});
const legacySchema = z.object({ mode: z.enum(["preview", "commit"]), rows: z.array(rowSchema).min(1).max(5000) });

const mappedSchema = z.object({
  mode: z.enum(["preview", "commit"]),
  source: mappingSourceSchema,
  fileName: z.string().max(200).optional(),
  columns: z.array(z.string().max(200)).min(1).max(300),
  rows: z.array(z.array(z.string().max(5000)).max(300)).min(1).max(5000),
  mapping: z.array(columnMappingSchema).max(300),
  decided: z.array(z.string().max(200)).max(300),
  remember: z.boolean().optional(),
});

/** Where the list came from and the lawful basis for holding it. Required on commit. */
const provenanceSchema = z.object({
  sourceNote: z.string().trim().min(3, "Say where this list came from.").max(200),
  lawfulBasis: z.enum(LAWFUL_BASES),
});

/** One contact to insert: top-level columns plus anything that goes into raw. */
type Candidate = { fields: Record<string, string>; raw: Record<string, unknown> | null };

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const provenance = provenanceSchema.safeParse({ sourceNote: body?.sourceNote, lawfulBasis: body?.lawfulBasis });
  if (body?.mode === "commit" && !provenance.success) {
    return NextResponse.json({ error: "Say where this list came from and pick a lawful basis before importing." }, { status: 400 });
  }

  let mode: "preview" | "commit";
  let candidates: Candidate[];
  let noName = 0;
  let afterCommit: (() => Promise<unknown>) | null = null;

  const mapped = mappedSchema.safeParse(body);
  if (mapped.success) {
    const m = mapped.data;
    mode = m.mode;
    const existingCustom = await loadCustomFields();
    const problems = validateMapping(m.columns, m.mapping, existingCustom.map((f) => f.key), new Set(m.decided));
    if (problems.length) return NextResponse.json({ error: problems[0].message, problems }, { status: 400 });

    // Custom fields are created only on commit; a preview just reads the typed label.
    let mapping = m.mapping;
    let labels: Record<string, string> = Object.fromEntries(existingCustom.map((f) => [f.key, f.label]));
    if (mode === "commit") {
      try { ({ mapping, labels } = await ensureCustomFields(m.mapping, profile.id)); }
      catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't create the custom field." }, { status: 500 }); }
      if (m.remember) afterCommit = () => saveMappings(m.source, mapping, profile.id);
    }

    const out = applyMapping(m.columns, m.rows, mapping, labels);
    candidates = [];
    out.forEach((r, i) => {
      if (!r.fields.name) { noName++; return; }
      const original: Record<string, string> = {};
      m.columns.forEach((c, j) => { const v = m.rows[i][j]; if (v != null && v !== "") original[c] = v; });
      candidates.push({
        fields: r.fields,
        raw: {
          ...(Object.keys(r.custom).length ? { __profile: { extra: r.custom } } : {}),
          import: { source: m.source, file: m.fileName ?? null, at: new Date().toISOString(), row: original },
        },
      });
    });
  } else {
    const legacy = legacySchema.safeParse(body);
    if (!legacy.success) return NextResponse.json({ error: "Each row needs at least a name; up to 5,000 rows." }, { status: 400 });
    mode = legacy.data.mode;
    candidates = legacy.data.rows.map((r) => ({
      fields: Object.fromEntries(Object.entries({ name: r.name, email: r.email, company: r.company, phone: r.phone, contact_type: r.type }).filter(([, v]) => v)) as Record<string, string>,
      raw: null,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();

  // De-dup: by email within the file, then against contacts already in the book.
  const seen = new Set<string>();
  let dupInFile = 0;
  const unique = candidates.filter((c) => {
    const key = c.fields.email?.toLowerCase();
    if (!key) return true;
    if (seen.has(key)) { dupInFile++; return false; }
    seen.add(key); return true;
  });
  const existing = new Set<string>();
  for (const part of chunk([...seen])) {
    const { data } = await db.from("crm_contacts").select("email").in("email", part);
    for (const r of (data ?? []) as Array<{ email: string | null }>) if (r.email) existing.add(r.email.toLowerCase());
  }
  const toCreate = unique.filter((c) => !(c.fields.email && existing.has(c.fields.email.toLowerCase())));
  const summary = {
    total: candidates.length + noName, toCreate: toCreate.length, skippedDupInFile: dupInFile, skippedExisting: unique.length - toCreate.length, skippedNoName: noName,
    sample: toCreate.slice(0, 5).map((c) => ({ name: c.fields.name, email: c.fields.email ?? "", company: c.fields.company ?? "" })),
  };
  if (mode === "preview") return NextResponse.json(summary);

  const scope = await getSalesScope(profile);
  let created = 0;
  for (const part of chunk(toCreate)) {
    const { error, data } = await db.from("crm_contacts").insert(part.map((c) => ({
      name: c.fields.name,
      email: c.fields.email || null,
      company: c.fields.company || null,
      phone: c.fields.phone || null,
      website: c.fields.website || null,
      country: c.fields.country || null,
      stage: c.fields.stage || null,
      company_domain: c.fields.company_domain || null,
      contact_type: c.fields.contact_type ?? null,
      ...(c.raw ? { raw: c.raw } : {}),
      source: "manual",
      ...(provenance.success ? { data_source_note: provenance.data.sourceNote, lawful_basis: provenance.data.lawfulBasis } : {}),
      external_id: c.fields.email?.toLowerCase() || `manual:${crypto.randomUUID()}`,
      owner_id: profile.id, assignee_ids: scope.isManager ? [] : [profile.id],
    }))).select("id");
    if (!error) created += (data ?? []).length;
  }
  let remembered = 0;
  if (afterCommit) remembered = Number(await afterCommit().catch(() => 0));
  return NextResponse.json({ ...summary, created, remembered });
}
