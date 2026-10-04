/**
 * AI on support requests. Everything here is internal: it helps staff, and
 * nothing reaches a founder until a person sends it.
 *
 * - triageRequest: topic, priority, and whether this is something the AI could
 *   answer alone (how-to) or needs a person (advisory, billing, bugs). Stored
 *   on the request as `ai_triage`; staff can ignore it. Never reassigns.
 * - draftResolutionSummary: the "here's what we fixed" summary staff edit
 *   before it goes out with "Did this solve your issue?".
 *
 * Each call's tokens and cost are written to the Support log, and billed to the
 * AI budget (Internal hubs, "Support reply drafts" / "Support triage").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import { logSupportEvent, type AiCost } from "./events";
import { getSupportThread, type SupportAiTriage } from "./support";
import { parseTriage } from "./triage-parse";

/* eslint-disable @typescript-eslint/no-explicit-any */
function svc(): SupabaseClient<any> {
  return createServiceRoleClient() as unknown as SupabaseClient<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function transcriptOf(messages: Array<{ author_role: string; body: string }>): string {
  return messages.map((m) => `${m.author_role === "staff" ? "Support" : "Founder"}: ${m.body}`).join("\n");
}

const TRIAGE_SYSTEM = `You triage support requests from founders on iCapOS, a capital readiness platform. Reply with JSON only:
{"topic": "2 to 4 words", "priority": "low" | "normal" | "high", "canAiAnswer": true | false, "reason": "one short sentence"}
canAiAnswer is true only for how-to questions about using the platform (where to find something, how a feature works).
It is false for anything about the founder's own numbers, financial model, valuation, raise, documents to review, billing or plan changes, refunds, bugs or errors, and anything account specific.
priority is high for a blocked raise, a bug stopping work, a billing problem, or an upset founder; low for general questions.`;

export async function triageRequest(requestId: string): Promise<SupportAiTriage | null> {
  if (!isClaudeConfigured()) return null;
  const thread = await getSupportThread(svc(), requestId);
  if (!thread) return null;

  let cost: AiCost | null = null;
  const text = await claudeComplete(
    [
      {
        role: "user",
        content: `Subject: ${thread.request.subject}\n${thread.request.context_item ? `Raised from: ${thread.request.context_item}\n` : ""}\n${transcriptOf(thread.messages) || "(no message)"}`,
      },
    ],
    {
      model: CLAUDE_HAIKU,
      maxTokens: 200,
      temperature: 0,
      locale: "en",
      system: TRIAGE_SYSTEM,
      usage: { category: "internal", feature: "admin_support_triage" },
      onUsage: (u) => (cost = u),
    },
  );
  const triage = parseTriage(text);
  if (!triage) return null;

  await svc().from("support_requests").update({ ai_triage: triage }).eq("id", requestId);
  await logSupportEvent({
    requestId,
    founderId: thread.request.founder_id,
    actor: "ai",
    kind: "ai_triage",
    summary: "AI triage",
    detail: `Topic ${triage.topic} · Priority ${triage.priority} · Can AI answer: ${triage.canAiAnswer ? "Yes, how-to" : "No, needs a person"}${triage.reason ? ` · ${triage.reason}` : ""}`,
    ai: cost,
  });
  return triage;
}

export async function draftResolutionSummary(requestId: string, staffId: string): Promise<{ summary: string } | { unavailable: true }> {
  if (!isClaudeConfigured()) return { unavailable: true };
  const thread = await getSupportThread(svc(), requestId);
  if (!thread) return { unavailable: true };

  let cost: AiCost | null = null;
  const summary = await claudeComplete(
    [
      {
        role: "user",
        content: `Support request: "${thread.request.subject}"\n\nConversation:\n${transcriptOf(thread.messages) || "(no messages)"}\n\nWrite a 1 to 3 sentence summary for the founder of what was done to resolve this. Plain text, no greeting, no sign-off. Only state what the conversation shows; do not invent fixes.`,
      },
    ],
    {
      model: CLAUDE_HAIKU,
      maxTokens: 220,
      temperature: 0.2,
      system: "You write short, factual, warm support summaries for founders on iCapOS. Never promise funding or give legal or financial guarantees.",
      usage: { category: "internal", feature: "admin_support" },
      onUsage: (u) => (cost = u),
    },
  );
  await logSupportEvent({
    requestId,
    founderId: thread.request.founder_id,
    actor: "ai",
    actorUserId: staffId,
    kind: "ai_summary",
    summary: "AI drafted the resolve summary",
    detail: "Not sent · waiting for staff review",
    ai: cost,
  });
  return { summary };
}
