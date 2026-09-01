import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadPartnerScoresBatch } from "@/lib/investor-rating/snapshot";
import { TIER_LABELS } from "@/lib/investor-rating/types";
import { tierFromScore } from "@/lib/investor-rating/scoring";
import { getRatingConfig } from "@/lib/investor-rating/weights";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Every investor for the Partner Scores page. The population is the Investor
// contacts in crm_contacts (the Sales Hub Investors group — Odoo + Form D promotions),
// unioned with platform members (investor_profiles) so members not yet in the CRM
// still appear. A contact gets a partner score only when it maps to a member (by
// email); everyone else is "New".
type Row = {
  id: string;
  name: string;
  firm: string | null;
  source: string;
  isMember: boolean;
  tier: string | null;
  score: number | null;
  engaged: number;
};

const CONTACT_CAP = 12000;

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const membership = sp.get("membership"); // members | prospects | null
  const sources = (sp.get("source") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const tiers = (sp.get("tier") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const minScore = Number(sp.get("minScore") ?? "0") || 0;
  const sort = sp.get("sort") ?? "score";
  const offset = Math.max(0, Number(sp.get("offset") ?? "0") || 0);
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? "100") || 100));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as unknown as SupabaseClient<any>;
  const { secFormDBonus } = await getRatingConfig(admin);

  // Members → partner scores, keyed by lowercase email for CRM matching.
  const { data: members } = await admin.from("investor_profiles").select("profile_id, firm_name");
  const memberList = (members ?? []) as Array<{ profile_id: string; firm_name: string | null }>;
  const memberIds = memberList.map((m) => m.profile_id).filter(Boolean);
  const emailToScore = new Map<string, { tier: string; score: number | null; engaged: number }>();
  const scoredProfileIds = new Set<string>();
  if (memberIds.length) {
    const scores = await loadPartnerScoresBatch(createServiceRoleClient(), memberIds);
    const { data: profs } = await admin.from("profiles").select("id, email, full_name").in("id", memberIds);
    const profById = new Map<string, { email: string | null; full_name: string | null }>();
    for (const p of (profs ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>) profById.set(p.id, { email: p.email, full_name: p.full_name });
    for (const m of memberList) {
      const ps = scores.get(m.profile_id);
      const email = profById.get(m.profile_id)?.email?.toLowerCase();
      if (email && ps) emailToScore.set(email, { tier: TIER_LABELS[ps.tier], score: ps.score, engaged: ps.sampleSize });
      if (ps) scoredProfileIds.add(m.profile_id);
    }
  }

  const rows: Row[] = [];
  // Investor contacts (the Sales Hub Investors group).
  const { data: contacts } = await admin
    .from("crm_contacts")
    .select("id, name, company, email, source, contact_type, module")
    .or("contact_type.eq.investor,module.eq.investor")
    .limit(CONTACT_CAP);
  for (const c of (contacts ?? []) as Array<{ id: string; name: string | null; company: string | null; email: string | null; source: string | null }>) {
    const m = c.email ? emailToScore.get(c.email.toLowerCase()) : undefined;
    const isFormD = c.source === "formd";
    let score = m?.score ?? null;
    let tier = m?.tier ?? null;
    // SEC Form D provenance bonus (capped at 100). Lifts an unscored Form D
    // investor from "New" to a verified floor of the bonus value.
    if (isFormD && secFormDBonus > 0) {
      score = Math.min(100, (score ?? 0) + secFormDBonus);
      tier = TIER_LABELS[tierFromScore(score)];
    }
    rows.push({
      id: `contact:${c.id}`,
      name: c.name ?? c.company ?? "Investor",
      firm: c.company,
      source: isFormD ? "SEC Form D" : c.source === "manual" ? "Manual" : c.source ?? "CRM",
      isMember: Boolean(m),
      tier,
      score,
      engaged: m?.engaged ?? 0,
    });
  }

  const counts = {
    all: rows.length,
    members: rows.filter((r) => r.isMember).length,
    prospects: rows.filter((r) => !r.isMember).length,
  };

  // Filter → sort → paginate in memory.
  let filtered = rows;
  if (membership === "members") filtered = filtered.filter((r) => r.isMember);
  else if (membership === "prospects") filtered = filtered.filter((r) => !r.isMember);
  if (q) filtered = filtered.filter((r) => r.name.toLowerCase().includes(q) || (r.firm ?? "").toLowerCase().includes(q));
  if (sources.length) filtered = filtered.filter((r) => sources.includes(r.source));
  if (tiers.length) filtered = filtered.filter((r) => (r.tier ? tiers.includes(r.tier.toLowerCase()) : tiers.includes("new")));
  if (minScore > 0) filtered = filtered.filter((r) => (r.score ?? -1) >= minScore);

  filtered.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    return (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name);
  });

  const page = filtered.slice(offset, offset + limit);
  return NextResponse.json({ investors: page, total: filtered.length, counts, limit, offset });
}
