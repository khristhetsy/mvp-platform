/**
 * Contact import field mappings. Staff only.
 *   GET    ?source=csv|xlsx              → { targets, saved, customFields }
 *   PUT    { source, mapping: [...] }    → { saved }  (create custom fields as needed)
 *   DELETE { source, column }            → { ok }     (the column is asked about again next import)
 * See src/lib/contacts/field-mapping.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { TARGET_FIELDS } from "@/lib/contacts/field-mapping";
import { columnMappingSchema, mappingSourceSchema } from "@/lib/contacts/field-mapping-schema";
import { deleteMapping, ensureCustomFields, loadCustomFields, loadSavedMappings, saveMappings } from "@/lib/contacts/field-mapping-store";

export const dynamic = "force-dynamic";

const source = mappingSourceSchema;
const columnMapping = columnMappingSchema;

async function staff() {
  return requireRole(["admin", "analyst"]).catch(() => null);
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await staff())) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const s = source.safeParse(req.nextUrl.searchParams.get("source") ?? undefined);
  const [saved, customFields] = await Promise.all([loadSavedMappings(s.success ? s.data : undefined), loadCustomFields()]);
  return NextResponse.json({ targets: TARGET_FIELDS.map(({ key, label, group }) => ({ key, label, group })), saved, customFields });
}

export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await staff();
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = z.object({ source, mapping: z.array(columnMapping).min(1).max(300) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const { mapping } = await ensureCustomFields(parsed.data.mapping, profile.id);
    return NextResponse.json({ saved: await saveMappings(parsed.data.source, mapping, profile.id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  if (!(await staff())) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = z.object({ source, column: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await deleteMapping(parsed.data.source, parsed.data.column);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}
