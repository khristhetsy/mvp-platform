/**
 * Founder investor directory search.
 *   GET ?q&type&stage&industry&state&source&investingNow=1&hasEmail=1&page
 *     → { rows, total, page, pageSize, access, tiers, plans, settings, facets }
 *   GET …&ids=1 → { ids, formd } every matching id not yet held (and which are Form D), for "Select all matching"
 * Published, non-network rows only; email and phone show only once imported.
 */
import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { founderDirectoryEnabled, PAGE_SIZE, directoryFacets, formdIdsAmong, loadFounderAccess, loadPlanAllowances, loadSettings, loadTiers, searchDirectory, searchDirectoryIds } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const many = (u: URLSearchParams, k: string) => u.getAll(k).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);

export async function GET(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;
  if (!(await founderDirectoryEnabled())) {
    return NextResponse.json({ error: "Investor directory isn't available right now." }, { status: 403 });
  }
  const u = new URL(request.url).searchParams;
  const query = {
    q: u.get("q") ?? undefined,
    types: many(u, "type"),
    stages: many(u, "stage"),
    industries: many(u, "industry"),
    states: many(u, "state"),
    sources: many(u, "source"),
    investingNow: u.get("investingNow") === "1",
    hasEmail: u.get("hasEmail") === "1",
    page: Number(u.get("page") ?? 1) || 1,
    sort: u.get("sort") === "newest" ? ("newest" as const) : ("firm" as const),
  };
  if (u.get("ids") === "1") {
    try {
      const ids = await searchDirectoryIds(query, auth.company.id);
      // Form D firms don't count toward the limit, so the page caps only the others.
      return NextResponse.json({ ids, formd: [...(await formdIdsAmong(ids))] });
    } catch (err) {
      console.error("[investor-directory] select all failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Couldn't select every match. Try again." }, { status: 500 });
    }
  }
  try {
    const [result, access, tiers, settings, facets, allowances] = await Promise.all([
      searchDirectory(query, auth.company.id),
      loadFounderAccess(auth.profile.id, auth.company.id),
      loadTiers(),
      loadSettings(),
      u.get("facets") === "1" ? directoryFacets() : Promise.resolve(null),
      loadPlanAllowances(),
    ]);
    return NextResponse.json({
      ...result,
      pageSize: PAGE_SIZE,
      access,
      tiers: tiers.filter((t) => t.key !== "free"),
      // What each plan holds, for the "Limits by plan" panel.
      plans: allowances.map((a) => ({ planType: a.plan_type, label: a.label, contacts: a.contacts })),
      settings: { require_terms: settings.require_terms, daily_cap: settings.daily_cap, allow_export: settings.allow_export, terms_version: settings.terms_version },
      facets,
    });
  } catch (err) {
    console.error("[investor-directory] search failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't load the directory. Try again." }, { status: 500 });
  }
}
