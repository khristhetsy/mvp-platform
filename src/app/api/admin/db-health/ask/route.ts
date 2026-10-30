import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { CLAUDE_HAIKU, claudeComplete, isClaudeConfigured } from "@/lib/claude";
import { loadDbHealth } from "@/lib/db-health/load";
import { adviceFacts, suggestActions } from "@/lib/db-health/advice";
import { baselineReady, daysCovered, normalRange } from "@/lib/db-health/baseline";
import { fmtMs } from "@/lib/db-health/tiles";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({ question: z.string().trim().min(1).max(300) });

/**
 * POST /api/admin/db-health/ask: explain the database readings in words.
 *
 * AI drafts, a person confirms. The facts are read here on the server, never taken
 * from the browser, and query text is replaced by a label before the model sees it.
 * The suggested actions come from rules (advice.ts), not from the model, and the
 * card only points at the buttons under Fix it. Nothing here changes any data.
 */
export async function POST(request: Request) {
  const auth = await requirePermissionApi("view_system_health");
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question of 300 characters or fewer." }, { status: 400 });

  const data = await loadDbHealth();
  const { now, settings, samples, incidents, jobs, longQueries, queryStats, pausedPaths } = data;
  const latest = samples[samples.length - 1] ?? null;
  const open = incidents.find((i) => !i.ended_at) ?? null;
  const state = open ? open.peak_state : latest?.state ?? null;

  const respVals = samples.map((s) => s.response_ms).filter((v): v is number => v !== null);
  const range = baselineReady(samples[0]?.taken_at ?? null, now) ? normalRange(respVals) : null;
  const baselineLine = range
    ? `response time 7 day average ${fmtMs(range.avg)}, normal range ${fmtMs(range.lo)} to ${fmtMs(range.hi)}`
    : `still building a baseline, ${Math.min(7, Math.floor(daysCovered(samples[0]?.taken_at ?? null, now)))} of 7 days of readings`;

  const suggestions = suggestActions({ state, longQueries, jobs, pausedPaths, settings });
  const facts = adviceFacts({ now, state, settings, latest, open, jobs, queryStats, baselineLine });

  if (!latest) return NextResponse.json({ text: "Nothing is measured yet, so there is nothing to explain. The first check runs within 5 minutes once the SQL has been run and the check is deployed.", suggestions });
  if (!isClaudeConfigured()) return NextResponse.json({ text: null, reason: "AI is not configured.", suggestions });

  try {
    const text = await claudeComplete(
      [{ role: "user", content: `Readings:\n${facts}\n\nQuestion from an admin: ${parsed.data.question}` }],
      {
        usage: { category: "internal", feature: "db_health_ask" },
        model: CLAUDE_HAIKU,
        maxTokens: 300,
        temperature: 0.2,
        system:
          "You explain the health of the iCapOS database to an admin who is not an engineer. Use only the figures in the readings; never invent a number, a name or a cause. If the readings do not answer the question, say so plainly. Say what the readings suggest and mark any cause as likely, not proven. You cannot change anything, so never say you did. Plain text, under 120 words, no headings, and do not use dashes as punctuation.",
      },
    );
    return NextResponse.json({ text: text?.trim() || null, suggestions });
  } catch {
    return NextResponse.json({ text: null, reason: "The AI request failed.", suggestions });
  }
}
