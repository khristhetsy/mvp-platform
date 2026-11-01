import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { listDocuments, listExamples, loadSettings, saveSettings, TrainingError } from "@/lib/sales-ai/training-store";

export const dynamic = "force-dynamic";

async function staff() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { profile: auth.profile };
}

// GET: everything on the AI training page. Read only. Document text stays on the server.
export async function GET(): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const [settings, documents, examples] = await Promise.all([loadSettings(), listDocuments(false), listExamples()]);
  return NextResponse.json({ settings, documents, examples });
}

const schema = z.object({
  blockedWords: z.array(z.string()).max(60),
  refundLine: z.string().max(400),
  skipPhrases: z.array(z.string()).max(80),
  skipTags: z.array(z.string()).max(40),
});

// PUT: save the wording rules and skip rules. The built-in copy rules cannot be changed here.
export async function PUT(req: Request): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    return NextResponse.json({ settings: await saveSettings(parsed.data, a.profile.id) });
  } catch (err) {
    if (err instanceof TrainingError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Could not save the settings." }, { status: 500 });
  }
}
