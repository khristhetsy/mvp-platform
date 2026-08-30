// SEC Form D — Investor Mode rollup (spec §3–§8, build steps 3+6). Deno runtime.
// Full recompute (idempotent): normalizes investor-side filings into firms +
// vehicles, resolves principals (firm-scoped HMAC — persisted rows carry no
// street), infers deal events via the confidence cascade, and populates activity
// fields + bands. Chained ~15m after formd-ingest, never concurrent (cron.sql).
//
// Known v0.2 limits (the Desk must state these): street-based hashing (the 0.75
// deal tier) needs computing at ingest with the address in memory, so cross-side
// matches here are 0.95 (firm named in the issuer's placement agents) or 0.55
// (name + director, stored for review, never displayed). Only >=0.75 feeds
// activity. Every non-board investor is invisible — a lead signal, not a cap table.

// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeFirm, principalIdentityHash, dealEventConfidence, DEAL_DISPLAY_THRESHOLD, activityBand, median } from "../_shared/formd/investor.ts";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => (v == null || v === "" ? null : Number(v));
const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();

Deno.serve(async () => {
  const env = Deno.env.toObject();
  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
  const hashKey = env.PRINCIPAL_HASH_KEY || env.SUPABASE_SERVICE_ROLE_KEY!;
  const now = new Date();
  const cutoff24 = new Date(now.getTime() - 730 * 24 * 3600 * 1000);

  const filings = async (leadType: string): Promise<Row[]> => {
    const { data } = await supabase
      .from("formd_filings")
      .select("accession_no, cik, company_name, city, state, phone, date_filed, date_first_sale, total_offering, total_sold, investor_count, industry, exemptions, placement_agents, formd_related_persons(first_name,last_name,full_name,relationships)")
      .eq("lead_type", leadType);
    return (data ?? []) as Row[];
  };

  const investors = await filings("investor");
  const issuers = await filings("issuer");

  // ── Firms + vehicles ────────────────────────────────────────────────────────
  type FirmAgg = {
    stem: string; state: string | null; display: string; city: string | null; phone: string | null;
    first: string | null; last: string | null; footprint: number; fundTypes: Set<string>;
    needsReview: boolean; vehicles: { cik: string; accession: string }[]; filings: Row[];
  };
  const firms = new Map<string, FirmAgg>();
  for (const f of investors) {
    const norm = normalizeFirm(String(f.company_name ?? ""));
    const state = s(f.state);
    const key = `${norm.firmStem}|${state ?? ""}`;
    let agg = firms.get(key);
    if (!agg) {
      agg = { stem: norm.firmStem, state, display: String(f.company_name ?? ""), city: s(f.city), phone: s(f.phone), first: s(f.date_filed), last: s(f.date_filed), footprint: 0, fundTypes: new Set(), needsReview: norm.needsReview, vehicles: [], filings: [] };
      firms.set(key, agg);
    }
    agg.needsReview = agg.needsReview || norm.needsReview;
    if (s(f.date_filed) && (!agg.first || String(f.date_filed) < agg.first)) agg.first = s(f.date_filed);
    if (s(f.date_filed) && (!agg.last || String(f.date_filed) > agg.last)) agg.last = s(f.date_filed);
    agg.footprint += Number(f.total_offering ?? 0) || 0;
    if (f.industry) agg.fundTypes.add(String(f.industry));
    if (!agg.phone && f.phone) agg.phone = s(f.phone);
    agg.vehicles.push({ cik: String(f.cik), accession: String(f.accession_no) });
    agg.filings.push(f);
  }

  // Full recompute: clear firms (cascades to vehicles/principals/deal_events), reinsert.
  await supabase.from("formd_firms").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Index issuer signals for the deal-event join.
  const issuerByPerson = new Map<string, Row[]>(); // "last|first" -> issuer filings
  for (const iss of issuers) {
    for (const p of ((iss.formd_related_persons as Row[]) ?? [])) {
      const k = `${lc(p.last_name)}|${lc(p.first_name)}`;
      (issuerByPerson.get(k) ?? issuerByPerson.set(k, []).get(k)!).push(iss);
    }
  }

  let firmCount = 0, principalCount = 0, dealCount = 0;

  for (const agg of firms.values()) {
    const { data: firmRow } = await supabase.from("formd_firms").insert({
      firm_stem: agg.stem, display_name: agg.display, city: agg.city, state_or_country: agg.state, phone: agg.phone,
      first_seen_at: agg.first, last_filing_at: agg.last, vehicle_count: agg.vehicles.length,
      regd_footprint: Math.round(agg.footprint) || null, fund_types: [...agg.fundTypes], needs_review: agg.needsReview,
    }).select("id").single();
    if (!firmRow) continue;
    const firmId = String(firmRow.id);
    firmCount++;

    await supabase.from("formd_firm_vehicles").insert(agg.vehicles.map((v) => ({ firm_id: firmId, cik: v.cik, accession_number: v.accession })));

    // Principals: dedupe the firm's related persons by firm-scoped hash.
    const principals = new Map<string, { first: string; last: string; rels: Set<string>; first_seen: string | null; last_seen: string | null }>();
    for (const f of agg.filings) {
      for (const p of ((f.formd_related_persons as Row[]) ?? [])) {
        if (!p.first_name || !p.last_name) continue;
        const h = principalIdentityHash({ firstName: String(p.first_name), lastName: String(p.last_name), firmId }, hashKey);
        let pr = principals.get(h);
        if (!pr) { pr = { first: String(p.first_name), last: String(p.last_name), rels: new Set(), first_seen: s(f.date_filed), last_seen: s(f.date_filed) }; principals.set(h, pr); }
        if (p.relationships) String(p.relationships).split(/[,;]/).forEach((r) => pr!.rels.add(r.trim()));
        if (s(f.date_filed) && (!pr.first_seen || String(f.date_filed) < pr.first_seen)) pr.first_seen = s(f.date_filed);
        if (s(f.date_filed) && (!pr.last_seen || String(f.date_filed) > pr.last_seen)) pr.last_seen = s(f.date_filed);
      }
    }

    const firmFirstFiling = agg.first;
    const displayableEvents: { round: number | null; issuer: string; industry: string | null; date: string | null; check: number | null; conf: number }[] = [];

    for (const [hash, pr] of principals) {
      const { data: prRow } = await supabase.from("formd_principals").insert({
        firm_id: firmId, first_name: pr.first, last_name: pr.last, relationship: [...pr.rels].filter(Boolean),
        identity_hash: hash, first_seen_at: pr.first_seen ?? agg.first, last_seen_at: pr.last_seen ?? agg.last,
      }).select("id").single();
      if (!prRow) continue;
      principalCount++;
      const principalId = String(prRow.id);
      const isDirector = [...pr.rels].some((r) => /director/i.test(r));

      const matches = issuerByPerson.get(`${lc(pr.last)}|${lc(pr.first)}`) ?? [];
      for (const iss of matches) {
        const namedInRecipients = lc(iss.placement_agents).includes(agg.stem);
        const postDates = Boolean(firmFirstFiling && s(iss.date_first_sale) && String(iss.date_first_sale) >= firmFirstFiling);
        const conf = dealEventConfidence({ namedInRecipients, identityHashMatch: false, nameMatch: true, isDirector, issuerPostDatesFundFirstFiling: postDates });
        if (conf < 0.55) continue;
        const amount = n(iss.total_sold);
        const invCount = n(iss.investor_count);
        await supabase.from("formd_deal_events").insert({
          principal_id: principalId, firm_id: firmId, issuer_cik: String(iss.cik), issuer_name: String(iss.company_name),
          issuer_accession: String(iss.accession_no), issuer_industry: s(iss.industry), date_of_first_sale: s(iss.date_first_sale),
          amount_sold: amount, total_offering: n(iss.total_offering), investor_count: invCount, securities_type: null,
          federal_exemption: s(iss.exemptions), confidence: conf,
        });
        dealCount++;
        if (conf >= DEAL_DISPLAY_THRESHOLD) {
          displayableEvents.push({ round: n(iss.total_offering), issuer: String(iss.company_name), industry: s(iss.industry), date: s(iss.date_first_sale), check: amount != null && invCount ? Math.round(amount / invCount) : null, conf });
        }
      }
    }

    // ── Activity fields + band (§8.4) — from displayable (>=0.75) events only ──
    if (displayableEvents.length > 0) {
      const dated = displayableEvents.filter((e) => e.date).sort((a, b) => (a.date! < b.date! ? 1 : -1));
      const latest = dated[0] ?? displayableEvents[0];
      const in24 = displayableEvents.filter((e) => e.date && new Date(e.date) >= cutoff24).length;
      const band = activityBand(in24);
      const est = band === "observed" ? median(displayableEvents.map((e) => e.check ?? NaN).filter((x) => Number.isFinite(x))) : null;
      await supabase.from("formd_firms").update({
        last_investment_at: latest.date, last_investment_issuer: latest.issuer, last_investment_round_size: latest.round,
        last_investment_confidence: latest.conf, est_check_size: est, investments_24mo: in24,
        sectors_observed: [...new Set(displayableEvents.map((e) => e.industry).filter(Boolean))],
        activity_band: band, updated_at: new Date().toISOString(),
      }).eq("id", firmId);
    }
  }

  const result = { ok: true, firms: firmCount, principals: principalCount, deal_events: dealCount, ran_at: now.toISOString() };
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
