import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { assignAgent, getSalesAiState, refreshSuggestions, SalesAiError } from "@/lib/sales-ai/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function staff() {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return { error: auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { profile: auth.profile };
}

// GET: the AI agent tab's state for this opportunity. Read only.
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const { id } = await params;
  const state = await getSalesAiState(id);
  if (!state) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  return NextResponse.json(state);
}

const putSchema = z.object({ agentId: z.string().uuid().nullable() });

// PUT: choose which built agent works this opportunity.
export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const { id } = await params;
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an agent." }, { status: 400 });
  try {
    await assignAgent(id, parsed.data.agentId, a.profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof SalesAiError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save the agent." }, { status });
  }
}

// POST: look at the agent's chats and file any stage moves for a person to confirm.
export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const a = await staff();
  if (a.error) return a.error;
  const { id } = await params;
  try {
    await refreshSuggestions(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not check the chats." }, { status: 500 });
  }
}
