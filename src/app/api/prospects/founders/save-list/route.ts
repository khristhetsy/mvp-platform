import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { saveFoundersToList } from "@/lib/prospects/founder-source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  filters: z.object({
    stage: z.string().optional(),
    sector: z.string().optional(),
    jurisdiction: z.string().optional(),
    minReadiness: z.number().optional(),
    minFunding: z.number().optional(),
    search: z.string().optional(),
  }),
  name: z.string().max(120).optional(),
  listId: z.string().uuid().optional(),
  contactIds: z.array(z.string().uuid()).max(20000).optional(),
});

// POST /api/prospects/founders/save-list — snapshot filtered/selected founders into a list.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!parsed.data.listId && !parsed.data.name?.trim()) {
    return NextResponse.json({ error: "Provide a list name or an existing list." }, { status: 400 });
  }

  try {
    const result = await saveFoundersToList(parsed.data.filters, {
      name: parsed.data.name,
      listId: parsed.data.listId,
      contactIds: parsed.data.contactIds,
    });
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
