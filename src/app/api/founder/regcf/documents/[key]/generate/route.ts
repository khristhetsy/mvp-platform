import { NextResponse } from "next/server";
import { gateAiRun } from "@/lib/ai-usage/gate";
import { gateRegCfFounderApi } from "@/lib/regcf/gate";
import { isRegCfDocKey } from "@/lib/regcf/documents";
import { generateRegCfDocument } from "@/lib/regcf/generate";
import { upsertRegCfDocument } from "@/lib/regcf/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST — AI-draft one document from the company profile, then save it. */
export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const gate = await gateRegCfFounderApi();
  if ("error" in gate) return gate.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;
  if (!isRegCfDocKey(key)) return NextResponse.json({ error: "Unknown document." }, { status: 400 });

  try {
    // Per-plan run cap (Admin, Feature Controls, AI usage limits).
    const aiRun = await gateAiRun(gate.profile.id, "regcf_documents");
    if (aiRun.blocked) return aiRun.blocked;
    const { content, aiGenerated } = await generateRegCfDocument(key, gate.company ?? {});
    await aiRun.done();
    await upsertRegCfDocument(gate.supabase, {
      founderId: gate.profile.id,
      companyId: gate.company?.id ?? null,
      docKey: key,
      content,
      aiGenerated,
    });
    return NextResponse.json({ content, aiGenerated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed." }, { status: 500 });
  }
}
