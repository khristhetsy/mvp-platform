import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { resolveSuggestion, SalesAiError } from "@/lib/sales-ai/service";

export const dynamic = "force-dynamic";

const schema = z.object({ suggestionId: z.string().uuid(), action: z.enum(["apply", "dismiss"]) });

// POST: a person applies or dismisses a suggested stage move. Applying uses the same
// update the stage bar uses, so the move is logged and stage sequences behave as for any move.
export async function POST(req: Request): Promise<Response> {
  const auth = await requireApiProfile(["admin", "analyst"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await resolveSuggestion(parsed.data.suggestionId, parsed.data.action, auth.profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof SalesAiError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update the suggestion." }, { status });
  }
}
