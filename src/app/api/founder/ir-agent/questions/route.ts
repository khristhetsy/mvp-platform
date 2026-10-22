import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { getQuestions, replaceQuestions } from "@/lib/ir-agent/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  questions: z
    .array(
      z.object({
        field: z.enum(["investor_type", "preferred_sectors", "check_size", "preferred_stages", "capital_types", "custom"]),
        prompt: z.string().trim().min(3).max(200),
        options: z.array(z.string().trim().min(1).max(40)).max(12),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(12),
});

/** Replace the agent's questions: wording, order, options, on or off, custom ones. One of each profile field at most. */
export async function PUT(req: Request) {
  const auth = await requireFounderAgentApi(req);
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Each question needs wording of 3 to 200 characters." }, { status: 400 });
  const seen = new Set<string>();
  for (const q of parsed.data.questions) {
    if (q.field === "custom") continue;
    if (seen.has(q.field)) return NextResponse.json({ error: "Each profile question can appear once." }, { status: 400 });
    seen.add(q.field);
  }
  if (!parsed.data.questions.some((q) => q.enabled)) return NextResponse.json({ error: "Keep at least one question on." }, { status: 400 });
  const ok = await replaceQuestions(auth.ctx.agent.id, parsed.data.questions);
  if (!ok) return NextResponse.json({ error: "Could not save questions." }, { status: 500 });
  return NextResponse.json({ questions: await getQuestions(auth.ctx.agent.id) });
}
