import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { generateFindingsFromText, AiNotConfiguredError } from "@/lib/diligence/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({ source_text: z.string().min(40).max(80000) });

/** POST — AI-draft domains/findings/claims from a business summary. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Paste a business summary (at least 40 characters)." }, { status: 400 });

  try {
    const { count } = await generateFindingsFromText(auth.supabase, id, auth.userId, parsed.data.source_text);
    return NextResponse.json({ count });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed." }, { status: 500 });
  }
}
