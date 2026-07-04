import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { getListDetail, renameList, setListArchived } from "@/lib/prospects/saved-lists";

export const dynamic = "force-dynamic";

// GET /api/prospects/lists/[id] — one list with a contact preview.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  try {
    const detail = await getListDetail(id);
    if (!detail) return NextResponse.json({ error: "List not found." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

const patchSchema = z.object({ name: z.string().max(120).optional(), archived: z.boolean().optional() });

// PATCH /api/prospects/lists/[id] — rename or archive.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    if (typeof parsed.data.name === "string") await renameList(id, parsed.data.name);
    if (typeof parsed.data.archived === "boolean") await setListArchived(id, parsed.data.archived);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
