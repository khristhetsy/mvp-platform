// CEO Hub — metric-aware "phrase of the day". One row per day in ceo_daily_phrase.
// Generated fresh each day (AI, tuned to how the departments are trending) with a
// deterministic curated fallback when AI is unavailable. Cheap read on the dashboard.

import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { claudeComplete, CLAUDE_HAIKU, isClaudeConfigured } from "@/lib/claude";
import { loadCeoPayload } from "./hub-data";
import { status as kpiStatus, deptScore } from "./kpi";

// ceo_daily_phrase isn't in the generated Supabase types yet; declare the row shape
// here and use the untyped service client (no file-level `any` cast needed).
type DailyPhraseRow = { business: string; phrase_date: string; phrase: string; model: string | null };

function db(): SupabaseClient { return serviceRoleClientUntyped(); }
function today(): string { return new Date().toISOString().slice(0, 10); }

const CURATED = [
  "Momentum compounds — win the day, then repeat.",
  "Clarity beats intensity. Point the team at the one thing that matters most.",
  "What gets measured gets moved. Watch the numbers, then act.",
  "Small consistent gains build unstoppable companies.",
  "Protect the team's focus like it's your scarcest asset — because it is.",
  "Decide fast on reversible calls; deliberate on the ones you can't undo.",
  "Great operators turn this week's miss into next week's system.",
  "Ship, measure, learn — velocity is a strategy.",
];
function curatedForToday(): string {
  const doy = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000);
  return CURATED[doy % CURATED.length];
}

/** Cheap read — today's stored phrase, or null if none yet. */
export async function loadTodayPhrase(): Promise<string | null> {
  const { data } = await db().from("ceo_daily_phrase").select("phrase").eq("business", "icapos").eq("phrase_date", today()).maybeSingle();
  return (data as Pick<DailyPhraseRow, "phrase"> | null)?.phrase ?? null;
}

/** Return today's phrase, generating + storing it if missing. Falls back to curated. */
export async function ensureTodayPhrase(force = false): Promise<string> {
  if (!force) {
    const existing = await loadTodayPhrase();
    if (existing) return existing;
  }

  let phrase = curatedForToday();
  let model: string | null = null;

  if (isClaudeConfigured()) {
    try {
      const payload = await loadCeoPayload();
      const scores = (["sales", "marketing", "operations"] as const).map((d) => {
        const rows = payload.kpis.filter((k) => k.dept === d && k.weeks.length > 0).map((k) => ({ status: kpiStatus(k.weeks[k.weeks.length - 1].value, k), weight: 1 }));
        return { dept: d, score: deptScore(rows) };
      });
      const ctx = { dept_scores: scores, brief: payload.brief?.headline ?? null };
      const out = await claudeComplete(
        [{ role: "user", content: `Context (JSON): ${JSON.stringify(ctx)}\n\nWrite ONE short motivational line (max 18 words) for the CEO to start the day. Ground it in how the departments are trending — encouraging if strong, focusing if weak. No quotes, no attribution, no emojis. Output only the sentence.` }],
        { system: "You are the AI Chief of Staff for iCapOS. One punchy, grounded motivational sentence. No preamble.", model: CLAUDE_HAIKU, maxTokens: 60, temperature: 0.8 },
      );
      const clean = out.trim().replace(/^["']|["']$/g, "").split("\n")[0]?.trim();
      if (clean) { phrase = clean.slice(0, 200); model = CLAUDE_HAIKU; }
    } catch { /* keep curated fallback */ }
  }

  try {
    const row: DailyPhraseRow = { business: "icapos", phrase_date: today(), phrase, model };
    await db().from("ceo_daily_phrase").upsert(row, { onConflict: "business,phrase_date" });
  } catch { /* non-fatal */ }
  return phrase;
}
