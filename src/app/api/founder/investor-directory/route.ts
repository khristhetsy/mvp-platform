/**
 * Founder investor directory search.
 *   GET ?q&type&stage&industry&state&source&investingNow=1&hasEmail=1&page
 *     → { rows, total, page, pageSize, access, tiers, settings, facets }
 * Published, non-network rows only; email and phone show only once imported.
 */
import { NextResponse } from "next/server";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { PAGE_SIZE, directoryFacets, loadFounderAccess, loadSettings, loadTiers, searchDirectory } from "@/lib/investor-directory/db";

export const dynamic = "force-dynamic";

const many = (u: URLSearchParams, k: string) => u.getAll(k).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);

export async function GET(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;
  const u = new URL(request.url).searchParams;
  try {
    const [result, access, tiers, settings, facets] = await Promise.all([
      searchDirectory({
        q: u.get("q") ?? undefined,
        types: many(u, "type"),
        stages: many(u, "stage"),
        industries: many(u, "industry"),
        states: many(u, "state"),
        sources: many(u, "source"),
        investingNow: u.get("investingNow") === "1",
        hasEmail: u.get("hasEmail") === "1",
        page: Number(u.get("page") ?? 1) || 1,
      }, auth.company.id),
      loadFounderAccess(auth.profile.id, auth.company.id),
      loadTiers(),
      loadSettings(),
      u.get("facets") === "1" ? directoryFacets() : Promise.resolve(null),
    ]);
    return NextResponse.json({
      ...result,
      pageSize: PAGE_SIZE,
      access,
      tiers: tiers.filter((t) => t.key !== "free"),
      settings: { require_terms: settings.require_terms, daily_cap: settings.daily_cap, allow_export: settings.allow_export, terms_version: settings.terms_version },
      facets,
    });
  } catch (err) {
    console.error("[investor-directory] search failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't load the directory. Try again." }, { status: 500 });
  }
}
