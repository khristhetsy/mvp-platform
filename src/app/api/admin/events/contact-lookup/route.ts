/**
 * GET /api/admin/events/contact-lookup?q=<name> — type-ahead for "Register a guest".
 *
 * Returns up to six Contacts whose name matches, with the fields the registration
 * form fills: name, company, title, country, email, phone. Runs through the same
 * search_contacts function as the Contacts page, with no count (the database is slow
 * per page, so one small page and one primary-key lookup is all it does).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { searchContacts, must } from "@/lib/sales/contacts-search";

export const dynamic = "force-dynamic";

// crm_contacts has columns not all in the generated types: use a loose client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** Odoo exports an empty field as the boolean false, which arrives as the string "false". */
function clean(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s === "" || s.toLowerCase() === "false" ? "" : s;
}

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_events");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ contacts: [] });

  try {
    const { rows } = await searchContacts(
      {
        spec: { match: "all", conditions: [{ field: "name", op: "contains", value: q }] },
        groupBy: null, groupValue: null, sort: "name", dir: "asc", offset: 0, limit: 6,
      },
      null,
      false,
    );

    // Job title lives in the Odoo export (raw.function); one primary-key lookup for the page.
    const titleById = new Map<string, string>();
    if (rows.length) {
      const t = await must<Array<{ id: string; title: string | null }> | null>(
        db().from("crm_contacts").select("id, title:raw->>function").in("id", rows.map((r) => r.id)),
        "event contact lookup: titles",
      );
      for (const row of t ?? []) titleById.set(row.id, clean(row.title));
    }

    return NextResponse.json({
      contacts: rows.map((r) => ({
        id: r.id,
        name: clean(r.name) || clean(r.email),
        email: clean(r.email),
        company: clean(r.company),
        title: titleById.get(r.id) ?? "",
        country: clean(r.country),
        phone: clean(r.phone) || clean(r.raw_phone) || clean(r.raw_mobile),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Contacts search failed." }, { status: 500 });
  }
}
