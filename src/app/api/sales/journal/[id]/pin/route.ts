import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { setJournalPinned } from "@/lib/forecast/journal";

export const dynamic = "force-dynamic";

const schema = z.object({ pinned: z.boolean() });

// PATCH /api/sales/journal/[id]/pin — the only mutable field on a journal entry.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "pinned boolean required." }, { status: 400 });
  try {
    await setJournalPinned(id, parsed.data.pinned);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to pin." }, { status: 500 });
  }
}
