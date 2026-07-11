import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { saveSectionEntry, listEntryVersions, type EntryStatus } from "@/lib/meetings/foundation";

export const dynamic = "force-dynamic";

// GET — version history for a section entry.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ entryId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { entryId } = await params;
  return NextResponse.json({ versions: await listEntryVersions(entryId) });
}

const patchSchema = z.object({
  content: z.string().max(20000).optional(),
  status: z.enum(["not_started", "draft", "ready", "presented", "deferred"]).optional(),
});

// PATCH — save a section entry (content and/or status). Records a version on content change.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { entryId } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid entry payload." }, { status: 400 });
  try {
    await saveSectionEntry(entryId, { content: parsed.data.content, status: parsed.data.status as EntryStatus | undefined }, profile.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save." }, { status: 500 });
  }
}
