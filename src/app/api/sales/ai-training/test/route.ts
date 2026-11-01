import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { SalesAiError, testDraft } from "@/lib/sales-ai/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ opportunityId: z.string().uuid() });

// POST: make a draft the way the AI agent tab would, saving and sending nothing.
export async function POST(req: Request): Promise<Response> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an opportunity." }, { status: 400 });
  try {
    return NextResponse.json(await testDraft(parsed.data.opportunityId));
  } catch (err) {
    if (err instanceof SalesAiError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Could not make the test draft." }, { status: 500 });
  }
}
