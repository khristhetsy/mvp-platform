import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/supabase/auth";
import { claudeComplete, isClaudeConfigured } from "@/lib/claude";

export const dynamic = "force-dynamic";

/**
 * Explains one dashboard metric in a sentence or two, then names the next action.
 *
 * Deliberately narrow. The tile sends the facts it already displays — its value,
 * its denominator, its flag — and nothing else, so the model has no room to
 * invent a figure. A tile with no supporting facts gets no explanation rather
 * than a generic "this measures your progress", which is the failure mode that
 * makes AI captions worthless at this scale.
 */
const schema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(60),
  /** "of 42", "gate 65" — the denominator, when there is one. */
  unit: z.string().max(120).optional(),
  detail: z.string().max(400).optional(),
  /** The warning or all-clear line already on the tile. */
  flag: z.string().max(400).optional(),
  /** Which workspace is asking — changes who the advice is addressed to. */
  audience: z.enum(["admin", "founder", "investor"]).default("admin"),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { label, value, unit, detail, flag, audience } = parsed.data;

  // No supporting context means nothing worth saying — refuse rather than pad.
  if (!detail && !flag && !unit) {
    return NextResponse.json({ text: null, reason: "not enough context to explain this metric" });
  }

  if (!isClaudeConfigured()) {
    return NextResponse.json({ text: null, reason: "AI is not configured" });
  }

  const who =
    audience === "founder"
      ? "the founder whose company this is"
      : audience === "investor"
        ? "the investor whose account this is"
        : "an iCapOS staff member reviewing a company";

  try {
    const text = await claudeComplete(
      [
        {
          role: "user",
          content:
            `Explain this dashboard metric to ${who}.\n\n` +
            `Metric: ${label}\nValue: ${value}\n` +
            (unit ? `Scale: ${unit}\n` : "") +
            (detail ? `Detail: ${detail}\n` : "") +
            (flag ? `Flagged: ${flag}\n` : "") +
            `\nTwo sentences maximum. First: what this number means in practice — not a restatement of the label. ` +
            `Second: the single most useful next action, or say plainly that nothing needs doing. ` +
            `Use only the figures above; never invent a number, a date or a name. Plain text, no heading.`,
        },
      ],
      {
        maxTokens: 160,
        temperature: 0.3,
        system:
          "You explain operating metrics on a fundraising platform. Concrete and short. You never restate the metric's label as its meaning, never invent figures, and say 'nothing to do here' when that is the truth.",
      },
    );
    return NextResponse.json({ text: text?.trim() || null });
  } catch {
    return NextResponse.json({ text: null, reason: "AI request failed" });
  }
}
