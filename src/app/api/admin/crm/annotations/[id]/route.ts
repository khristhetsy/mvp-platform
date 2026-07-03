import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { getAnnotation, upsertAnnotation } from "@/lib/crm-connectors/annotations";
import { CRM_INTERNAL_STATUSES } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  owner: z.string().max(120).nullish(),
  status: z.enum(CRM_INTERNAL_STATUSES).nullish(),
  tags: z.array(z.string().max(60)).max(30).optional(),
  notes: z.string().max(10_000).nullish(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const annotation = await getAnnotation(decodeURIComponent(id)).catch(() => null);
  return NextResponse.json({ annotation });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    const annotation = await upsertAnnotation(decodeURIComponent(id), parsed.data, profile.id);
    return NextResponse.json({ annotation });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save." }, { status: 500 });
  }
}
