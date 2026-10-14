/**
 * GET /api/admin/events/contact-lookup?q=<name> — type-ahead for "Register a guest".
 *
 * Returns up to six Contacts whose name matches, with the fields the registration
 * form fills: name, company, title, country, email, phone, plus the profile values the
 * form maps (investor types, stages, industries, check and round size, business summary;
 * see lib/icfo-events/contact-profile-map.ts). Runs through the same
 * search_contacts function as the Contacts page, with no count (the database is slow
 * per page, so one small page and one primary-key lookup is all it does).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { searchContacts, must } from "@/lib/sales/contacts-search";
import type { ContactProfileBits } from "@/lib/icfo-events/contact-profile-map";

export const dynamic = "force-dynamic";

// crm_contacts has columns not all in the generated types: use a loose client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** Odoo exports an empty field as the boolean false, which arrives as the string "false". */
function clean(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s === "" || s.toLowerCase() === "false" ? "" : s;
}

const EMPTY_PROFILE: ContactProfileBits = {
  investorTypes: [], fundingStages: [], industries: [], investmentSize: [], founderStage: [], seekAmount: [], businessSummary: "",
};

/** Profile lists arrive as real arrays, or (from the Odoo extras) as a string like '["Seed Round"]'. */
function toList(v: unknown): string[] {
  let xs: unknown[] = [];
  if (Array.isArray(v)) xs = v;
  else if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("[")) { try { const j = JSON.parse(s); xs = Array.isArray(j) ? j : [s]; } catch { xs = [s]; } }
    else if (s) xs = [s];
  }
  return xs.map((x) => String(x).trim()).filter((x) => x !== "" && x.toLowerCase() !== "false");
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

    // Job title lives in the Odoo export (raw.function) and the rest of what the form can use
    // lives in the profile. One primary-key lookup for the page (six rows at most).
    const extraById = new Map<string, { title: string; phone2: string; profile: ContactProfileBits }>();
    if (rows.length) {
      const t = await must<Array<{ id: string; title: string | null; profile: Record<string, unknown> | null }> | null>(
        db().from("crm_contacts").select("id, title:raw->>function, profile").in("id", rows.map((r) => r.id)),
        "event contact lookup: profile",
      );
      for (const row of t ?? []) {
        const p = row.profile ?? {};
        const extra = (p.extra && typeof p.extra === "object" ? p.extra : {}) as Record<string, unknown>;
        extraById.set(row.id, {
          title: clean(row.title),
          phone2: clean(typeof extra["Phone 2"] === "string" ? (extra["Phone 2"] as string) : ""),
          profile: {
            investorTypes: toList(p.investorTypes),
            fundingStages: toList(p.fundingStages),
            industries: toList(p.industries),
            investmentSize: toList(extra["Investor investment size?"]),
            founderStage: toList(extra["Entrepreneur funding stage?"]),
            seekAmount: toList(extra["Entrepreneur seeking amount of capital?"]),
            businessSummary: clean(typeof extra["Entrepreneur business summary"] === "string" ? (extra["Entrepreneur business summary"] as string) : ""),
          },
        });
      }
    }

    return NextResponse.json({
      contacts: rows.map((r) => {
        const x = extraById.get(r.id);
        return {
          id: r.id,
          name: clean(r.name) || clean(r.email),
          email: clean(r.email),
          company: clean(r.company),
          title: x?.title ?? "",
          country: clean(r.country),
          phone: clean(r.phone) || clean(r.raw_phone) || clean(r.raw_mobile) || (x?.phone2 ?? ""),
          profile: x?.profile ?? EMPTY_PROFILE,
        };
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Contacts search failed." }, { status: 500 });
  }
}
