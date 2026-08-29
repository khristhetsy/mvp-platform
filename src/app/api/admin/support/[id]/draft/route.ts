import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupportThread } from "@/lib/support/support";
import { claudeComplete, isClaudeConfigured } from "@/lib/claude";

export const dynamic = "force-dynamic";

// Draft a founder-facing reply from the thread. Reuses the platform Claude helper
// and degrades gracefully when AI is not configured. Staff always edit before send.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const { id } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const thread = await getSupportThread(supabase, id);
  if (!thread) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  if (!isClaudeConfigured()) {
    return NextResponse.json({ draft: "", unavailable: true });
  }

  const transcript = thread.messages
    .map((m) => `${m.author_role === "staff" ? "Support" : "Founder"}: ${m.body}`)
    .join("\n");
  const context = [
    thread.request.context_item ? `Topic: ${thread.request.context_item}` : null,
    thread.request.context_stage ? `Stage: ${thread.request.context_stage}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    const draft = await claudeComplete(
      [
        {
          role: "user",
          content: `A founder on the iCapOS fundraising platform opened a support request titled "${thread.request.subject}". ${context}\n\nConversation so far:\n${transcript || "(no messages yet)"}\n\nDraft a concise, warm, practical reply to the founder that moves them forward. Plain text, no salutation line beyond a short greeting, no sign-off block.`,
        },
      ],
      {
        maxTokens: 400,
        temperature: 0.4,
        system:
          "You are an iCapOS support specialist helping founders prepare to raise capital. Be specific and actionable. Never promise funding or make legal/financial guarantees. Keep it under 120 words.",
      },
    );
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json({ draft: "", unavailable: true });
  }
}
