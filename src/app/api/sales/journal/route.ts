import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listJournal, addJournalEntry, type JournalType } from "@/lib/forecast/journal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const filter = (req.nextUrl.searchParams.get("filter") ?? "all") as JournalType | "all";
  return NextResponse.json({ entries: await listJournal(filter) });
}

const createSchema = z.object({
  entry_type: z.enum(["note", "win", "loss", "deal"]),
  body: z.string().min(1).max(4000),
  dealRef: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "An entry type and body are required." }, { status: 400 });
  try {
    const entry = await addJournalEntry({ entry_type: parsed.data.entry_type, body: parsed.data.body, authorId: profile.id, dealRef: parsed.data.dealRef ?? null });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add entry." }, { status: 500 });
  }
}
