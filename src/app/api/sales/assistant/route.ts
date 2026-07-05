import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import { listPipelines } from "@/lib/sales/pipelines";
import { daysSince } from "@/lib/operations/escalations";

export const dynamic = "force-dynamic";

type SalesFacts = {
  open: number; won: number; lost: number;
  pipelineValueUsd: number; wonValueUsd: number;
  byStage: { stage: string; count: number }[];
  stalled: { title: string; days: number }[];
};

async function gatherSalesFacts(): Promise<SalesFacts> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createServiceRoleClient();
  const { data } = await admin.from("sales_opportunities").select("title, status, value_cents, stage_id, updated_at");
  const opps = (data ?? []) as Array<{ title: string; status: string; value_cents: number | null; stage_id: string | null; updated_at: string | null }>;
  const pipelines = await listPipelines();
  const stageName = new Map(pipelines.flatMap((p) => p.stages).map((s) => [s.id, s.name]));

  const open = opps.filter((o) => o.status === "open");
  const won = opps.filter((o) => o.status === "won");
  const byStageMap = new Map<string, number>();
  for (const o of open) {
    const n = o.stage_id ? (stageName.get(o.stage_id) ?? "Unstaged") : "Unstaged";
    byStageMap.set(n, (byStageMap.get(n) ?? 0) + 1);
  }
  const stalled = open
    .map((o) => ({ title: o.title, days: daysSince(o.updated_at) }))
    .filter((o) => o.days >= 14)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  return {
    open: open.length,
    won: won.length,
    lost: opps.filter((o) => o.status === "lost").length,
    pipelineValueUsd: Math.round(open.reduce((a, o) => a + (o.value_cents ?? 0), 0) / 100),
    wonValueUsd: Math.round(won.reduce((a, o) => a + (o.value_cents ?? 0), 0) / 100),
    byStage: [...byStageMap.entries()].map(([stage, count]) => ({ stage, count })),
    stalled,
  };
}

function block(f: SalesFacts): string {
  return [
    `Open opportunities: ${f.open} (pipeline value $${f.pipelineValueUsd.toLocaleString()})`,
    `Won: ${f.won} ($${f.wonValueUsd.toLocaleString()}) · Lost: ${f.lost}`,
    `By stage: ${f.byStage.map((s) => `${s.stage}: ${s.count}`).join("; ") || "none"}`,
    `Stalled 14+ days: ${f.stalled.length ? f.stalled.map((s) => `${s.title} (${s.days}d)`).join("; ") : "none"}`,
  ].join("\n");
}

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const facts = await gatherSalesFacts();
  return NextResponse.json({ status: facts, aiConfigured: isClaudeConfigured() });
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { message, history } = body as { message?: string; history?: { role: "user" | "assistant"; content: string }[] };
  if (!message?.trim()) return NextResponse.json({ error: "Message required." }, { status: 400 });

  const facts = await gatherSalesFacts();
  if (!isClaudeConfigured()) {
    return NextResponse.json({ reply: `AI isn't configured (add ANTHROPIC_API_KEY). Snapshot: ${facts.open} open opps worth $${facts.pipelineValueUsd.toLocaleString()}, ${facts.won} won. ${facts.stalled.length ? `${facts.stalled.length} stalled 14+ days.` : "Nothing stalled."}` });
  }

  const system = `You are the AI Sales advisor for iCapOS admins (selling the iCapOS product to founders). Be concise (under 120 words), specific, and actionable — suggest the next best action, the admin decides. You never send emails or act on your own.
GROUND RULES: use ONLY the facts below. Never invent opportunities, numbers, or contacts.

FACTS:
${block(facts)}`;

  const messages = [...(Array.isArray(history) ? history.slice(-6) : []), { role: "user" as const, content: message.trim() }];
  try {
    const reply = await claudeComplete(messages, { system, model: CLAUDE_HAIKU, maxTokens: 400, temperature: 0.3 });
    return NextResponse.json({ reply: reply || "I couldn't generate a response — try rephrasing." });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Advisor failed." }, { status: 500 });
  }
}
