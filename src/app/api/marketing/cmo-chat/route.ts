import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";

export const dynamic = "force-dynamic";

const CMO_SYSTEM_PROMPT = `You are a world-class B2B SaaS Chief Marketing Officer (CMO) advising iCapOS — an investor-readiness and deal management platform for family offices, VCs, and angel investors.

Your role is to provide concise, actionable, data-driven marketing advice. You think like a CMO who has scaled B2B fintech companies. You understand email deliverability, open rates, click rates, funnel optimization, audience segmentation, copywriting for financial professionals, and outbound sequencing.

When given live metrics, benchmark them against B2B fintech/SaaS industry averages:
- Open rate benchmark: 21–25%
- Click rate benchmark: 3–5%
- Deliverability benchmark: 95%+
- Unsubscribe rate benchmark: <0.5%
- Spam rate benchmark: <0.08%

Always:
- Be direct and specific. No fluff.
- Give one clear recommendation per issue.
- Reference the user's actual numbers when they are provided.
- Focus on what moves the needle: subject lines, CTAs, segmentation, timing, sequence design.
- Keep responses under 150 words unless a detailed breakdown is requested.

The target audience for iCapOS emails is: family office managers, fund CFOs, angel investors, VC analysts. They are senior, time-poor, and skeptical of generic outreach. Messaging must feel personal, specific, and credible.`;

export async function POST(request: Request) {
  await requireRole(["admin"]);

  const body = await request.json().catch(() => ({}));
  const { message, metrics } = body as {
    message: string;
    metrics?: {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      replied: number;
      bounced: number;
      unsubscribed: number;
      openRate: string;
      clickRate: string;
      deliverability: string;
      unsubRate: string;
    };
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured. Add ANTHROPIC_API_KEY to Vercel environment variables." },
      { status: 503 }
    );
  }

  // Fetch fresh 30-day metrics if not provided
  let liveMetrics = metrics;
  if (!liveMetrics) {
    try {
      const supabase = await marketingDb();
      const since30d = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const eventTypes = ["sent", "delivered", "opened", "clicked", "replied", "bounced", "unsubscribed"];
      const funnelData: Record<string, number> = {};
      await Promise.all(
        eventTypes.map(async (et) => {
          const { count } = await supabase
            .from("marketing_events")
            .select("*", { count: "exact", head: true })
            .eq("event_type", et)
            .gte("occurred_at", since30d);
          funnelData[et] = count ?? 0;
        })
      );
      const s = funnelData["sent"] ?? 0;
      liveMetrics = {
        sent: s,
        delivered: funnelData["delivered"] ?? 0,
        opened: funnelData["opened"] ?? 0,
        clicked: funnelData["clicked"] ?? 0,
        replied: funnelData["replied"] ?? 0,
        bounced: funnelData["bounced"] ?? 0,
        unsubscribed: funnelData["unsubscribed"] ?? 0,
        openRate: s > 0 ? ((funnelData["opened"] / s) * 100).toFixed(1) : "0",
        clickRate: s > 0 ? ((funnelData["clicked"] / s) * 100).toFixed(1) : "0",
        deliverability: s > 0 ? ((funnelData["delivered"] / s) * 100).toFixed(1) : "0",
        unsubRate: s > 0 ? ((funnelData["unsubscribed"] / s) * 100).toFixed(2) : "0",
      };
    } catch {
      // proceed without metrics
    }
  }

  const metricsContext = liveMetrics
    ? `\n\nLive metrics (last 30 days):\n- Sent: ${liveMetrics.sent}\n- Delivered: ${liveMetrics.delivered}\n- Opened: ${liveMetrics.opened} (${liveMetrics.openRate}%)\n- Clicked: ${liveMetrics.clicked} (${liveMetrics.clickRate}%)\n- Replied: ${liveMetrics.replied}\n- Bounced: ${liveMetrics.bounced}\n- Unsubscribed: ${liveMetrics.unsubscribed} (${liveMetrics.unsubRate}%)\n- Deliverability: ${liveMetrics.deliverability}%`
    : "";

  const reply = await claudeComplete(
    [{ role: "user", content: message }],
    {
      model:     CLAUDE_HAIKU,
      maxTokens: 400,
      system:    CMO_SYSTEM_PROMPT + metricsContext,
    }
  );

  return NextResponse.json({ reply });
}
