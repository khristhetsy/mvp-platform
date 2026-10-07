import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupportThread } from "@/lib/support/support";
import { claudeComplete, isClaudeConfigured } from "@/lib/claude";
import { getSupportSettings } from "@/lib/support/settings";
import { logSupportEvent, type AiCost } from "@/lib/support/events";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Draft a founder-facing reply from the thread. Reuses the platform Claude helper
// and degrades gracefully when AI is not configured. Staff always edit before send.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const thread = await getSupportThread(supabase, id);
  if (!thread) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  // Support queue, Notifications, AI: "Draft replies for staff".
  if (!isClaudeConfigured() || !(await getSupportSettings()).ai.drafts) {
    return NextResponse.json({ draft: "", unavailable: true });
  }

  // Optional rewrite of an existing draft: { tone: "shorter" | "friendlier", base: "..." }.
  const opts = (await req.json().catch(() => ({}))) as { tone?: string; base?: string; auto?: boolean };
  const tone = opts.tone === "shorter" || opts.tone === "friendlier" ? opts.tone : null;
  const base = typeof opts.base === "string" ? opts.base.slice(0, 4000) : "";

  // The suggestion made when a ticket opens is reused until a new message arrives,
  // so opening the same ticket again doesn't spend another AI call.
  if (opts.auto && !tone) {
    const lastMsg = thread.messages.filter((m) => !m.is_internal).at(-1)?.created_at ?? thread.request.created_at;
    const { data: prev } = await (createServiceRoleClient() as unknown as SupabaseClient)
      .from("support_events")
      .select("meta, created_at")
      .eq("request_id", id)
      .eq("kind", "ai_draft")
      .gt("created_at", lastMsg)
      .order("created_at", { ascending: false })
      .limit(5);
    const cached = ((prev ?? []) as Array<{ meta: { suggestion?: string } | null }>).find((e) => e.meta?.suggestion)?.meta?.suggestion;
    if (cached) return NextResponse.json({ draft: cached, cached: true });
  }

  const transcript = thread.messages
    .filter((m) => !m.is_internal)
    .map((m) => `${m.author_role === "staff" ? "Support" : "Founder"}: ${m.body}`)
    .join("\n");
  const context = [
    thread.request.context_item ? `Topic: ${thread.request.context_item}` : null,
    thread.request.context_stage ? `Stage: ${thread.request.context_stage}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    let cost: AiCost | null = null;
    const draft = await claudeComplete(
      [
        {
          role: "user",
          content: tone && base
            ? `Rewrite this support reply to a founder so it is ${tone === "shorter" ? "shorter and more direct, keeping every fact" : "warmer and friendlier, keeping every fact"}. Plain text only.\n\nReply:\n${base}`
            : `A founder on the iCapOS fundraising platform opened a support request titled "${thread.request.subject}". ${context}\n\nConversation so far:\n${transcript || "(no messages yet)"}\n\nDraft a concise, warm, practical reply to the founder that moves them forward. Only state facts that appear in the conversation; never invent numbers, cells or figures from their documents. Plain text, no salutation line beyond a short greeting, no sign-off block.`,
        },
      ],
      { usage: { category: "internal", feature: "admin_support" },
        maxTokens: 400,
        temperature: 0.4,
        system:
          "You are an iCapOS support specialist helping founders prepare to raise capital. Be specific and actionable. Never promise funding or make legal/financial guarantees. Keep it under 120 words.",
        onUsage: (u) => (cost = u),
      },
    );
    await logSupportEvent({
      requestId: id,
      founderId: thread.request.founder_id,
      actor: "ai",
      actorUserId: profile.id,
      kind: "ai_draft",
      summary: tone ? `AI rewrote a reply (${tone}) for ${profile.full_name ?? "staff"}` : opts.auto ? `AI suggested a reply when ${profile.full_name ?? "staff"} opened the ticket` : `AI drafted a reply for ${profile.full_name ?? "staff"}`,
      detail: "Not sent · waiting for staff review",
      meta: opts.auto && !tone ? { suggestion: draft } : null,
      ai: cost,
    });
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json({ draft: "", unavailable: true });
  }
}
