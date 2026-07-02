import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU, CLAUDE_SONNET } from "@/lib/claude";
import { listPages, getPage } from "@/lib/aeo/store";
import { systemFor, buildAeoGrounding, parseAction, recentTurns } from "@/lib/marketing/copilot/prompts";

export const dynamic = "force-dynamic";

const schema = z.object({
  topic: z.enum(["aeo", "cmo"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).min(1).max(30),
  context: z.object({ pageId: z.string().uuid().optional() }).optional(),
});

async function cmoGrounding(): Promise<string> {
  try {
    const db = marketingDb();
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const types = ["sent", "delivered", "opened", "clicked", "replied", "bounced", "unsubscribed"];
    const f: Record<string, number> = {};
    await Promise.all(
      types.map(async (et) => {
        const { count } = await db.from("marketing_events").select("id", { count: "exact", head: true }).eq("event_type", et).gte("occurred_at", since);
        f[et] = count ?? 0;
      }),
    );
    const s = f.sent ?? 0;
    if (s === 0) return "\n\nLive metrics (30d): no sends recorded yet.";
    const pct = (n: number) => ((n / s) * 100).toFixed(1);
    return `\n\nLive metrics (last 30 days): sent ${s}, delivered ${f.delivered} (${pct(f.delivered)}%), opened ${f.opened} (${pct(f.opened)}%), clicked ${f.clicked} (${pct(f.clicked)}%), replied ${f.replied}, bounced ${f.bounced}, unsubscribed ${f.unsubscribed}.`;
  } catch {
    return "";
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole(["admin"]);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    if (!isClaudeConfigured()) {
      return NextResponse.json({ error: "AI is not configured. Add ANTHROPIC_API_KEY in the environment." }, { status: 503 });
    }

    const { topic, messages, context } = parsed.data;

    let grounding = "";
    if (topic === "aeo") {
      const pages = await listPages();
      const current = context?.pageId ? await getPage(context.pageId) : null;
      grounding = buildAeoGrounding(pages, current);
    } else {
      grounding = await cmoGrounding();
    }

    const raw = await claudeComplete(recentTurns(messages), {
      model: topic === "aeo" ? CLAUDE_SONNET : CLAUDE_HAIKU,
      maxTokens: topic === "aeo" ? 900 : 500,
      system: systemFor(topic, grounding),
    });

    const { reply, action } = parseAction(raw);
    return NextResponse.json({ reply, action });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Copilot failed." }, { status: 500 });
  }
}
