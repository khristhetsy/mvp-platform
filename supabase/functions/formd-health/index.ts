// Form D Desk — Investor Mode · §11 health checks. Deno runtime, daily cron.
// The parser's + rollup's report card. Emits an operational_activity_event for
// each breached assertion so a silent regression surfaces before December.
//   - unclassified rate > 2% of the latest ingest day  → parser problem
//   - firm-to-vehicle ratio outside 0.2–0.6            → normalization drifted
//   - zero deal events created in 7 days               → the join is broken
//   - needs_review > 10% of firms                       → suffix rules need work
// (OFAC hits alert immediately from formd-screening, independent of this.)

// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async () => {
  const env = Deno.env.toObject();
  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
  const alerts: { check: string; detail: Record<string, unknown> }[] = [];
  const count = async (table: string, apply?: (q: ReturnType<ReturnType<typeof supabase.from>["select"]>) => unknown) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (apply) q = apply(q) as typeof q;
    const { count: c } = await q;
    return c ?? 0;
  };

  // 1) Unclassified rate on the most recent ingest day.
  const { data: lastDay } = await supabase
    .from("formd_filings").select("date_filed").order("date_filed", { ascending: false }).limit(1).maybeSingle();
  const day = (lastDay as { date_filed?: string } | null)?.date_filed;
  if (day) {
    const total = await count("formd_filings", (q) => q.eq("date_filed", day));
    const uncl = await count("formd_filings", (q) => q.eq("date_filed", day).eq("lead_type", "unclassified"));
    const rate = total ? uncl / total : 0;
    if (rate > 0.02) alerts.push({ check: "unclassified_rate", detail: { day, rate: Number(rate.toFixed(3)), total, unclassified: uncl } });
  }

  // 2) Firm-to-vehicle ratio.
  const firms = await count("formd_firms");
  const vehicles = await count("formd_firm_vehicles");
  if (firms > 0 && vehicles > 0) {
    const ratio = firms / vehicles;
    if (ratio < 0.2 || ratio > 0.6) alerts.push({ check: "firm_vehicle_ratio", detail: { firms, vehicles, ratio: Number(ratio.toFixed(3)) } });
  }

  // 3) Zero deal events created in the last 7 days.
  const sevenAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const recentDeals = await count("formd_deal_events", (q) => q.gte("created_at", sevenAgo));
  if (recentDeals === 0) alerts.push({ check: "no_deal_events_7d", detail: { since: sevenAgo } });

  // 4) needs_review share of firms.
  if (firms > 0) {
    const nr = await count("formd_firms", (q) => q.eq("needs_review", true));
    const share = nr / firms;
    if (share > 0.1) alerts.push({ check: "needs_review_share", detail: { firms, needs_review: nr, share: Number(share.toFixed(3)) } });
  }

  if (alerts.length) {
    await supabase.from("operational_activity_events").insert(
      alerts.map((a) => ({ event_type: "formd_health_alert", metadata: { check: a.check, ...a.detail } })),
    );
  }

  return new Response(JSON.stringify({ ok: true, firms, vehicles, alerts, ran_at: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
});
