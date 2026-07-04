import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { saveMatchesToList } from "@/lib/prospects/lists";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  filters: z.object({
    side: z.string().optional(),
    segment: z.string().optional(),
    status: z.string().optional(),
    leadStatus: z.string().optional(),
    source: z.string().optional(),
    minScore: z.number().optional(),
    sector: z.string().optional(),
    search: z.string().optional(),
  }),
  name: z.string().max(120).optional(),
  listId: z.string().uuid().optional(),
});

// POST /api/prospects/save-list — snapshot the filtered matches into a list.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!parsed.data.listId && !parsed.data.name?.trim()) {
    return NextResponse.json({ error: "Provide a list name or an existing list." }, { status: 400 });
  }

  try {
    const result = await saveMatchesToList(parsed.data.filters, { listId: parsed.data.listId, name: parsed.data.name });
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
