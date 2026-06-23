import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gateRegCfFounderApi } from "@/lib/regcf/gate";
import { isRegCfDocKey } from "@/lib/regcf/documents";
import { upsertRegCfDocument } from "@/lib/regcf/store";

export const dynamic = "force-dynamic";

const schema = z.object({ content: z.string().max(60000) });

/** PUT — save the founder's edited content for one document. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const gate = await gateRegCfFounderApi();
  if ("error" in gate) return gate.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;
  if (!isRegCfDocKey(key)) return NextResponse.json({ error: "Unknown document." }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid content." }, { status: 400 });

  try {
    await upsertRegCfDocument(gate.supabase, {
      founderId: gate.profile.id,
      companyId: gate.company?.id ?? null,
      docKey: key,
      content: parsed.data.content,
      aiGenerated: false,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save." }, { status: 500 });
  }
}
