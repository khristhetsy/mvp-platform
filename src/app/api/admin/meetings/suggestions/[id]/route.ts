import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { confirmSuggestion, dismissSuggestion } from "@/lib/meetings/ai";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["confirm", "dismiss"]) });

// POST — confirm (creates a real task) or dismiss an AI suggestion. Human-initiated.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  try {
    if (parsed.data.action === "confirm") {
      const task = await confirmSuggestion(id, profile.id);
      return NextResponse.json({ ok: true, task });
    }
    await dismissSuggestion(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to resolve suggestion." }, { status: 500 });
  }
}
