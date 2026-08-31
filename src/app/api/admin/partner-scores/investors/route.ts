import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadPartnerScoresBatch } from "@/lib/investor-rating/snapshot";
import { TIER_LABELS } from "@/lib/investor-rating/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Every investor for the Partner Scores page: platform members (investor_profiles
// + profiles, with their computed partner score) unioned with prospects
// (prospect_investors — Form D promotions and imports, which have no score yet).
// Search / source / tier / min-score / sort / pagination all applied server-side.
type Row = {
  id: string;
  name: string;
  firm: string | null;
  source: string; // "Member" | "SEC Form D" | "Imported" | ...
  isMember: boolean;
  tier: string | null; // display label, null for unrated
  score: number | null;
  engaged: number;
};

const MEMBER_CAP = 2000;
const PROSPECT_CAP = 8000;

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const sources = (sp.get("source") ?? "").split(",").map((s) => s.trim()).filter(Boolean); // Member | SEC Form D | Imported
  const tiers = (sp.get("tier") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const minScore = Number(sp.get("minScore") ?? "0") || 0;
  const sort = sp.get("sort") ?? "score"; // score | name
  const offset = Math.max(0, Number(sp.get("offset") ?? "0") || 0);
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? "100") || 100));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as unknown as SupabaseClient<any>;
  const rows: Row[] = [];

  // ── Members ────────────────────────────────────────────────────────────────
  const { data: members } = await admin
    .from("investor_profiles")
    .select("profile_id, firm_name, investor_type")
    .limit(MEMBER_CAP);
  const memberList = (members ?? []) as Array<{ profile_id: string; firm_name: string | null; investor_type: string | null }>;
  const ids = memberList.map((m) => m.profile_id).filter(Boolean);
  const profileNames = new Map<string, { full_name: string | null; email: string | null }>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      profileNames.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }
  const scores = await loadPartnerScoresBatch(createServiceRoleClient(), ids);
  for (const m of memberList) {
    const ps = scores.get(m.profile_id);
    const p = profileNames.get(m.profile_id);
    rows.push({
      id: `member:${m.profile_id}`,
      name: p?.full_name ?? p?.email ?? m.firm_name ?? "Investor",
      firm: m.firm_name,
      source: "Member",
      isMember: true,
      tier: ps ? TIER_LABELS[ps.tier] : null,
      score: ps?.score ?? null,
      engaged: ps?.sampleSize ?? 0,
    });
  }

  // ── Prospects ──────────────────────────────────────────────────────────────
  const { data: prospects } = await admin
    .from("prospect_investors")
    .select("id, name, investor_type, source")
    .limit(PROSPECT_CAP);
  for (const pr of (prospects ?? []) as Array<{ id: string; name: string; investor_type: string | null; source: string | null }>) {
    rows.push({
      id: `prospect:${pr.id}`,
      name: pr.name ?? "Investor",
      firm: null,
      source: pr.source === "SEC Form D" ? "SEC Form D" : pr.source ?? "Imported",
      isMember: false,
      tier: null,
      score: null,
      engaged: 0,
    });
  }

  // ── Filter → sort → paginate (in memory; two tables merged) ─────────────────
  let filtered = rows;
  if (q) filtered = filtered.filter((r) => r.name.toLowerCase().includes(q) || (r.firm ?? "").toLowerCase().includes(q));
  if (sources.length) filtered = filtered.filter((r) => sources.includes(r.source));
  if (tiers.length) filtered = filtered.filter((r) => (r.tier ? tiers.includes(r.tier.toLowerCase()) : tiers.includes("new")));
  if (minScore > 0) filtered = filtered.filter((r) => (r.score ?? -1) >= minScore);

  filtered.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    // score desc, rated before unrated, then name
    const sa = a.score ?? -1, sb = b.score ?? -1;
    return sb - sa || a.name.localeCompare(b.name);
  });

  const counts = {
    all: rows.length,
    members: rows.filter((r) => r.isMember).length,
    prospects: rows.filter((r) => !r.isMember).length,
  };
  const page = filtered.slice(offset, offset + limit);
  return NextResponse.json({ investors: page, total: filtered.length, counts, limit, offset });
}
