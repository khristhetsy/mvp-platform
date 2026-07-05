import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import { ONBOARDING_STEPS } from "@/lib/onboarding/progress";
import { listTasks } from "@/lib/operations/tasks";
import { daysSince, ONBOARDING_SLA_DAYS } from "@/lib/operations/escalations";

export const dynamic = "force-dynamic";

type Facts = {
  name: string;
  industry: string | null;
  reviewStatus: string | null;
  percent: number;
  overdueDays: number;
  pastDue: boolean;
  steps: { id: string; title: string; completed: boolean }[];
  openTasks: string[];
};

// Gather grounded facts about a company record — no AI, just the data.
async function gatherCompanyFacts(entityId: string): Promise<Facts | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("companies")
    .select("id, company_name, industry, review_status, onboarding_progress_percent, onboarding_completed_at, onboarding_step_state, updated_at")
    .eq("id", entityId)
    .maybeSingle();
  if (!data) return null;
  const c = data as Record<string, unknown>;

  const stepState = (c.onboarding_step_state ?? {}) as Record<string, unknown>;
  const steps = ONBOARDING_STEPS.map((s) => {
    const entry = stepState[s.id] as { completed?: boolean } | undefined;
    return { id: s.id, title: s.title, completed: Boolean(entry?.completed) };
  });

  const overdueDays = daysSince(c.updated_at as string | null);
  const tasks = await listTasks("company", entityId).catch(() => []);

  return {
    name: (c.company_name as string) ?? "Company",
    industry: (c.industry as string) ?? null,
    reviewStatus: (c.review_status as string) ?? null,
    percent: Math.round((c.onboarding_progress_percent as number) ?? 0),
    overdueDays,
    pastDue: !c.onboarding_completed_at && overdueDays >= ONBOARDING_SLA_DAYS,
    steps,
    openTasks: tasks.filter((t) => t.status !== "done").map((t) => t.title),
  };
}

function factsBlock(f: Facts): string {
  return [
    `Company: ${f.name}${f.industry ? ` (${f.industry})` : ""}`,
    `Onboarding: ${f.percent}% complete${f.pastDue ? `, ${f.overdueDays} days past the ${ONBOARDING_SLA_DAYS}-day SLA` : ""}`,
    `Steps — ${f.steps.map((s) => `${s.title}: ${s.completed ? "done" : "not done"}`).join("; ")}`,
    `Open tasks: ${f.openTasks.length ? f.openTasks.join("; ") : "none"}`,
    `Review status: ${f.reviewStatus ?? "n/a"}`,
  ].join("\n");
}

// GET — deterministic status for the assistant panel header.
export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const entityId = req.nextUrl.searchParams.get("entityId");
  const entityType = req.nextUrl.searchParams.get("entityType");
  if (entityType !== "company" || !entityId) return NextResponse.json({ error: "company entityId required." }, { status: 400 });
  const facts = await gatherCompanyFacts(entityId);
  if (!facts) return NextResponse.json({ error: "Record not found." }, { status: 404 });
  return NextResponse.json({ status: facts, aiConfigured: isClaudeConfigured() });
}

// POST — grounded AI chat / advice for this record.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { entityType, entityId, message, history } = body as {
    entityType?: string; entityId?: string; message?: string; history?: { role: "user" | "assistant"; content: string }[];
  };
  if (entityType !== "company" || !entityId || !message?.trim()) {
    return NextResponse.json({ error: "company entityId and message required." }, { status: 400 });
  }

  const facts = await gatherCompanyFacts(entityId);
  if (!facts) return NextResponse.json({ error: "Record not found." }, { status: 404 });

  if (!isClaudeConfigured()) {
    // Deterministic fallback so the panel is still useful without an API key.
    const nextStep = facts.steps.find((s) => !s.completed);
    const reply = `AI isn't configured (add ANTHROPIC_API_KEY). From the data: ${facts.name} is ${facts.percent}% onboarded${facts.pastDue ? `, ${facts.overdueDays} days past SLA` : ""}. Next incomplete step: ${nextStep ? nextStep.title : "none — onboarding looks complete"}.`;
    return NextResponse.json({ reply });
  }

  const system = `You are the Operations Assistant for iCapOS admins — you help an admin move a founder through onboarding and due diligence.
Be concise (under 120 words), specific, and actionable. Recommend one clear next step.
GROUND RULES: use ONLY the facts below. Never invent steps, documents, or data not present. If you lack info, say what to check.

FACTS:
${factsBlock(facts)}`;

  const messages = [
    ...(Array.isArray(history) ? history.slice(-6) : []),
    { role: "user" as const, content: message.trim() },
  ];

  try {
    const reply = await claudeComplete(messages, { system, model: CLAUDE_HAIKU, maxTokens: 400, temperature: 0.3 });
    return NextResponse.json({ reply: reply || "I couldn't generate a response — try rephrasing." });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Assistant failed." }, { status: 500 });
  }
}
