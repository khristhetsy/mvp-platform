import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { getContactFieldOptions, type FieldOptions } from "@/lib/sales/contact-field-options";

export const dynamic = "force-dynamic";

const TTL_MS = 24 * 60 * 60 * 1000; // self-refresh the cached options once a day

function hasValues(f: FieldOptions | null | undefined): boolean {
  return !!f && Object.keys(f).length > 0;
}

// GET /api/sales/contacts/field-options — distinct option values per profile
// field, for the click-to-edit selection pickers. Served from a precomputed
// cache row (instant); recomputed and re-cached when missing or older than a day.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = serviceRoleClientUntyped();

    const { data: row } = await db.from("crm_facet_cache").select("data, updated_at").eq("id", "field_options").maybeSingle();
    const cached = (row?.data ?? null) as FieldOptions | null;
    const fresh = row?.updated_at ? Date.now() - new Date(row.updated_at).getTime() < TTL_MS : false;
    if (fresh && hasValues(cached)) return NextResponse.json({ options: cached });

    const options = await getContactFieldOptions(db, true);
    if (hasValues(options)) {
      await db.from("crm_facet_cache").upsert({ id: "field_options", data: options, updated_at: new Date().toISOString() }, { onConflict: "id" });
      return NextResponse.json({ options });
    }
    return NextResponse.json({ options: hasValues(cached) ? cached : {} });
  } catch {
    return NextResponse.json({ options: {} });
  }
}
