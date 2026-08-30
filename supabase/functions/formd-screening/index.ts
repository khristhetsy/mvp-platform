// Form D Desk — Investor Mode · §10 screening (OFAC first). Deno runtime.
// Downloads the OFAC SDN list, fuzzy-matches firm + principal names, and writes
// formd_screening rows. A 'hit' is the hard stop promote_prospect_investor()
// already enforces; any hit also emits an immediate operational event (§11).
// Weekly on pg_cron (cron.sql). Highest-value check available and free.
//
// What this is NOT: KYC, AML, beneficial ownership, source of funds, adverse
// media. External language stays "screened against OFAC and SEC enforcement" —
// never "KYC" or unqualified "due diligence" (§10).

// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2";

const SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv";
const HIT = 0.9; // conservative — an OFAC false positive blocks a promote
const REVIEW = 0.78;

const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function trigrams(s: string): Set<string> {
  const t = ` ${norm(s)} `;
  const g = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3));
  return g;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// Minimal CSV field split honoring quotes (SDN rows: ent_num,"name","type",...).
function csvFields(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

Deno.serve(async () => {
  const env = Deno.env.toObject();
  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

  // 1) Fetch + parse the SDN list into name buckets (first 4 normalized chars).
  const res = await fetch(SDN_URL);
  if (!res.ok) return new Response(JSON.stringify({ error: `SDN fetch ${res.status}` }), { status: 502 });
  const text = await res.text();

  type Sdn = { name: string; type: string; grams: Set<string> };
  const buckets = new Map<string, Sdn[]>();
  const bucketKey = (s: string) => norm(s).slice(0, 4);
  for (const line of text.split(/\r?\n/)) {
    const f = csvFields(line);
    if (f.length < 3) continue;
    const name = f[1]?.trim();
    if (!name || name === "-0-") continue;
    const sdn: Sdn = { name, type: (f[2] ?? "").toLowerCase(), grams: trigrams(name) };
    const k = bucketKey(name);
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(sdn);
  }

  const match = (name: string): { result: "hit" | "review"; sdn: string; score: number } | null => {
    const grams = trigrams(name);
    const cands = buckets.get(bucketKey(name)) ?? [];
    let best = { s: 0, n: "" };
    for (const c of cands) {
      const s = jaccard(grams, c.grams);
      if (s > best.s) best = { s, n: c.name };
    }
    if (best.s >= HIT) return { result: "hit", sdn: best.n, score: best.s };
    if (best.s >= REVIEW) return { result: "review", sdn: best.n, score: best.s };
    return null;
  };

  // 2) Screen firms (entity names) and principals (individual names).
  const { data: firms } = await supabase.from("formd_firms").select("id, display_name");
  const { data: principals } = await supabase.from("formd_principals").select("id, first_name, last_name");

  let hits = 0, reviews = 0;
  const rows: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];

  for (const f of (firms ?? []) as Record<string, unknown>[]) {
    const m = match(String(f.display_name));
    if (!m) continue;
    rows.push({ subject_type: "firm", subject_id: f.id, check_type: "ofac_sdn", result: m.result, detail: { sdn: m.sdn, score: Number(m.score.toFixed(2)) } });
    if (m.result === "hit") { hits++; events.push({ event_type: "formd_ofac_hit", entity_id: f.id, metadata: { kind: "firm", name: f.display_name, sdn: m.sdn } }); }
    else reviews++;
  }
  for (const p of (principals ?? []) as Record<string, unknown>[]) {
    const m = match(`${p.first_name} ${p.last_name}`);
    if (!m) continue;
    rows.push({ subject_type: "principal", subject_id: p.id, check_type: "ofac_sdn", result: m.result, detail: { sdn: m.sdn, score: Number(m.score.toFixed(2)) } });
    if (m.result === "hit") { hits++; events.push({ event_type: "formd_ofac_hit", entity_id: p.id, metadata: { kind: "principal", name: `${p.first_name} ${p.last_name}`, sdn: m.sdn } }); }
    else reviews++;
  }

  if (rows.length) await supabase.from("formd_screening").insert(rows);
  if (events.length) await supabase.from("operational_activity_events").insert(events); // §11 immediate signal

  return new Response(JSON.stringify({ ok: true, sdn_names: text.split(/\r?\n/).length, hits, reviews, ran_at: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
});
