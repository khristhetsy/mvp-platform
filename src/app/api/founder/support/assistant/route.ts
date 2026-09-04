import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getJourneyOverview } from "@/lib/founder/stage-gate-status";
import { getSubscription } from "@/lib/subscriptions/get-subscription";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU, type ClaudeMessage } from "@/lib/claude";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
});

// Grounds the assistant in what iCapOS actually is, so it doesn't invent
// features. Kept short and honest; account-specific facts come from context.
const PRODUCT_BRIEF = `iCapOS is a capital-readiness and investor-distribution platform for founders. A founder's raise moves through four stages, in order: Stage 1 Onboarding, Stage 2 Preparation, Stage 3 Marketing, Stage 4 Closing. The tools — Capital Readiness Rating (CRR), valuation, data room/documents, and e-learning — are included on every paid plan. What the paid plans add is distribution: your matched investors are revealed and your materials are sent to them. Plans are Basic ($499/mo, up to 25 matched investors, DIY outreach), Professional ($1,000/mo, up to 100, monthly live presentation slot, brokered intro requests), and the SPV Program ($3,500/mo, done-for-you, 3-month minimum). Investor accounts are free. There are no success fees, no carry, and no commission on an introduction. Investor interest shown on the platform is a non-binding indication of interest, not a commitment.`;

function buildSystem(ctx: {
  name: string;
  company: string | null;
  stage: string | null;
  plan: string | null;
}): string {
  return [
    "You are the iCapOS in-app support assistant, helping a founder use the platform to run their raise.",
    "",
    "About the product:",
    PRODUCT_BRIEF,
    "",
    "Who you're talking to:",
    `- Name: ${ctx.name}`,
    ctx.company ? `- Company: ${ctx.company}` : "",
    ctx.stage ? `- Current stage: ${ctx.stage}` : "",
    ctx.plan ? `- Plan: ${ctx.plan}` : "",
    "",
    "How to help:",
    "- Be concise, warm, and plain-spoken. Prefer 2-5 sentences. Use the founder's stage and plan to make answers specific.",
    "- Point them to the right place in the app by name (e.g. Stage 2 — Preparation, the Documents area, Settings → Billing & subscription, the How it works guides).",
    "- You can explain how features work, what unlocks a stage, what a plan includes, and what to do next. You cannot see private data you weren't given here, and you cannot take actions on their account — say so plainly when relevant.",
    "- Do NOT give legal, tax, securities, or investment advice. iCapOS is not a broker-dealer, placement agent, or investment adviser. For those questions, suggest they consult a qualified professional.",
    "- If you don't know, or the request needs a human (billing changes, something account-specific, or anything you can't resolve), say so and tell them to use “Hand off to the iCapOS team” below the chat.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["founder"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Founders only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message payload." }, { status: 400 });

  const name = profile.full_name?.split(" ")[0] ?? profile.full_name ?? "there";

  if (!isClaudeConfigured()) {
    return NextResponse.json({
      reply:
        "The assistant is offline right now. Use “Hand off to the iCapOS team” below and a person will help you — usually within one business day.",
    });
  }

  // Best-effort grounding context. Never let a context miss break the chat.
  let company: string | null = null;
  let stage: string | null = null;
  let plan: string | null = null;
  try {
    const supabase = (await createServerSupabaseClient()) as unknown as SupabaseClient<Database>;
    const [{ company: activeCompany }, journey, subscription] = await Promise.all([
      getActiveCompanyForUser(profile),
      getJourneyOverview(supabase, profile.id).catch(() => null),
      getSubscription(profile.id).catch(() => null),
    ]);
    company = activeCompany?.company_name ?? null;
    if (journey?.currentSlug) {
      const cur = journey.stages.find((s) => s.slug === journey.currentSlug);
      stage = cur ? `Stage ${cur.stageNumber} — ${cur.name} (${cur.line})` : null;
    }
    plan = subscription ? PLAN_LABELS[subscription.plan_type] ?? null : null;
  } catch {
    /* grounding is optional */
  }

  const system = buildSystem({ name, company, stage, plan });
  const messages: ClaudeMessage[] = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    const reply = await claudeComplete(messages, {
      model: CLAUDE_HAIKU,
      system,
      maxTokens: 700,
      temperature: 0.3,
    });
    return NextResponse.json({
      reply:
        reply ||
        "I couldn't put together an answer just now. Try rephrasing, or use “Hand off to the iCapOS team” below.",
    });
  } catch {
    return NextResponse.json(
      {
        reply:
          "Something went wrong reaching the assistant. Please try again, or use “Hand off to the iCapOS team” below.",
      },
      { status: 200 },
    );
  }
}
