// CEO Hub — AI Chief of Staff. Runs on cron: refresh snapshots, assemble context,
// generate the daily brief + per-KPI AI coaching (yellow/red or status-changed, all
// on the weekly run), zod-validate, store, and email per notification prefs. Never
// invents metrics; benchmark text comes from the registry. Fails soft on any error.

import { z } from "zod";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { claudeComplete, CLAUDE_SONNET, isClaudeConfigured } from "@/lib/claude";
import { sendEmail } from "@/lib/email/send-email";
import { computeWeekSnapshots } from "./snapshot";
import { loadCeoPayload } from "./hub-data";
import { status as kpiStatus, deptScore } from "./kpi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }
function today(): string { return new Date().toISOString().slice(0, 10); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(raw: string): any {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    return JSON.parse((fenced ? fenced[1] : raw).trim());
  } catch {
    return null;
  }
}

const briefSchema = z.object({ headline: z.string().max(400), sections: z.array(z.object({ title: z.string().max(80), body: z.string().max(1200) })).max(6) });
const kpiAiSchema = z.array(z.object({ kpi_key: z.string(), diagnosis: z.string().max(1000), solutions: z.array(z.string().max(400)).max(3), mentorship: z.string().max(600), coach_prompt: z.string().max(300) }));

export interface BriefingResult { week: string; snapshots: number; briefWritten: boolean; kpiAiWritten: number; emailsSent: number; skippedReason?: string }

export async function runBriefing(mode: "weekly" | "daily" = "daily"): Promise<BriefingResult> {
  const snap = await computeWeekSnapshots();
  const week = snap.weekStart;

  if (!isClaudeConfigured()) {
    return { week, snapshots: snap.computed.length, briefWritten: false, kpiAiWritten: 0, emailsSent: 0, skippedReason: "claude_not_configured" };
  }

  const payload = await loadCeoPayload();
  const { data: sessions } = await db().from("ceo_meeting_sessions").select("meeting_key, session_date, note, decisions").order("session_date", { ascending: false }).limit(6);

  const computable = payload.kpis.filter((k) => k.weeks.length > 0);
  const withStatus = computable.map((k) => {
    const vals = k.weeks.map((w) => w.value);
    const cur = vals[vals.length - 1];
    const prev = vals.length > 1 ? vals[vals.length - 2] : null;
    const st = kpiStatus(cur, k);
    const prevSt = prev != null ? kpiStatus(prev, k) : st;
    return { k, cur, st, changed: st !== prevSt };
  });
  const needing = mode === "weekly" ? withStatus : withStatus.filter((x) => x.st !== "g" || x.changed);

  const scores = (["sales", "marketing", "operations"] as const).map((d) => ({
    dept: d,
    score: deptScore(withStatus.filter((x) => x.k.dept === d).map((x) => ({ status: x.st, weight: x.k.weight }))),
  }));

  // ── Daily brief ──
  let briefWritten = false;
  let briefHeadline = "";
  const briefCtx = {
    week,
    dept_scores: scores,
    misses: withStatus.filter((x) => x.st !== "g").map((x) => ({ kpi: x.k.label, value: x.cur, target: x.k.target, status: x.st, owner: x.k.owner })),
    open_recommendations: payload.recommendations.map((r) => ({ title: r.title, priority: r.priority })),
    goals: payload.goals.map((g) => ({ title: g.title, current: g.current, target: g.target, period: g.period })),
    recent_decisions: ((sessions ?? []) as Array<{ session_date: string; decisions: string[] }>).flatMap((s) => (Array.isArray(s.decisions) ? s.decisions : []).map((d) => ({ date: s.session_date, decision: d }))),
  };
  try {
    const out = await claudeComplete(
      [{ role: "user", content: `Context (JSON):\n${JSON.stringify(briefCtx)}\n\nWrite the CEO's operating brief. Output STRICT JSON {"headline": string, "sections": [{"title": string, "body": string}]} with 3–4 sections (e.g. What matters most, Wins, Watch items, Decisions needed). Cite magnitudes; reference journal decisions by date when relevant. Internal-only — no external performance claims.` }],
      { system: "You are the AI Chief of Staff for iCapOS, briefing the CEO in the second person. Concise, specific, never invent metrics. Respond with JSON only.", model: CLAUDE_SONNET, maxTokens: 1200, temperature: 0.4 },
    );
    const parsed = briefSchema.safeParse(parseJson(out));
    if (parsed.success) {
      await db().from("ceo_briefs").upsert({ business: "icapos", brief_date: today(), headline: parsed.data.headline, sections: parsed.data.sections, model: CLAUDE_SONNET }, { onConflict: "business,brief_date" });
      briefWritten = true;
      briefHeadline = parsed.data.headline;
    }
  } catch { /* fail soft */ }

  // ── Per-KPI AI coaching (batched, capped) ──
  let kpiAiWritten = 0;
  const batch = needing.slice(0, 12);
  if (batch.length > 0) {
    const items = batch.map((x) => ({ kpi_key: x.k.key, label: x.k.label, fmt: x.k.fmt, direction: x.k.direction, target: x.k.target, red_line: x.k.redLine, benchmark: x.k.benchmark, recent_weeks: x.k.weeks.slice(-8).map((w) => w.value), owner: x.k.owner, status: x.st }));
    try {
      const out = await claudeComplete(
        [{ role: "user", content: `KPIs needing analysis (JSON):\n${JSON.stringify(items)}\n\nOpen recommendations — do NOT repeat these as solutions: ${JSON.stringify(payload.recommendations.map((r) => r.title))}\n\nFor each KPI return: diagnosis (cite magnitude + most likely cause using funnel relationships), solutions (<=3, concrete), mentorship (one leadership principle, second person), coach_prompt (one literal question). Benchmark text is provided — never invent metrics or benchmarks. Output a STRICT JSON array of {"kpi_key","diagnosis","solutions","mentorship","coach_prompt"}.` }],
        { system: "You are the AI Chief of Staff for iCapOS coaching the CEO on department KPIs. Internal-only. Respond with JSON only.", model: CLAUDE_SONNET, maxTokens: 3200, temperature: 0.5 },
      );
      const parsed = kpiAiSchema.safeParse(parseJson(out));
      if (parsed.success) {
        const valid = new Set(batch.map((b) => b.k.key));
        const rows = parsed.data.filter((r) => valid.has(r.kpi_key)).map((r) => ({ kpi_key: r.kpi_key, week_start: week, diagnosis: r.diagnosis, solutions: r.solutions, mentorship: r.mentorship, coach_prompt: r.coach_prompt, model: CLAUDE_SONNET }));
        if (rows.length > 0) {
          await db().from("ceo_kpi_ai").upsert(rows, { onConflict: "kpi_key,week_start" });
          kpiAiWritten = rows.length;
        }
      }
    } catch { /* fail soft */ }
  }

  // ── Emails ──
  let emailsSent = 0;
  if (briefWritten) {
    try {
      const col = mode === "weekly" ? "email_weekly" : "email_daily";
      const { data: prefs } = await db().from("ceo_notification_prefs").select("user_id").eq(col, true);
      const ids = ((prefs ?? []) as Array<{ user_id: string }>).map((p) => p.user_id);
      if (ids.length) {
        const { data: people } = await db().from("profiles").select("email").in("id", ids);
        const emails = ((people ?? []) as Array<{ email: string | null }>).map((p) => p.email).filter((e): e is string => Boolean(e));
        if (emails.length) {
          const sections = (briefCtx.misses.length ? `<p>${briefCtx.misses.length} KPI(s) below target.</p>` : "");
          const ok = await sendEmail({ to: emails, subject: `CEO brief — ${today()}`, html: `<h2 style="font-family:sans-serif;color:#0A1A40">${briefHeadline}</h2>${sections}<p><a href="https://icapos.com/admin/ceo">Open the CEO Hub →</a></p>` });
          if (ok) emailsSent = emails.length;
        }
      }
    } catch { /* fail soft */ }
  }

  return { week, snapshots: snap.computed.length, briefWritten, kpiAiWritten, emailsSent };
}
