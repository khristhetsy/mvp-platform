import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { listExpired, clearExpired, getRetentionMonths, setRetentionMonths } from "@/lib/verify/retention";

export const dynamic = "force-dynamic";

// GET /api/prospects/retention — retention period + contacts past it that were never contacted.
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const db = serviceRoleClientUntyped();
  try {
    const [months, expired] = await Promise.all([getRetentionMonths(db), listExpired(db)]);
    return NextResponse.json({ months, ...expired });
  } catch (err) {
    return NextResponse.json({ months: await getRetentionMonths(db), rows: [], total: 0, error: err instanceof Error ? err.message : "Could not load." });
  }
}

const clearSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

// POST /api/prospects/retention — clear finder-sourced values on the approved contacts. Admin only.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = clearSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Select contacts to clear." }, { status: 400 });
  try {
    return NextResponse.json(await clearExpired(serviceRoleClientUntyped(), parsed.data.ids));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Clear failed." }, { status: 500 });
  }
}

const monthsSchema = z.object({ months: z.number().int().min(1).max(60) });

// PUT /api/prospects/retention — change the retention period. Admin only. Applies to values accepted from now on.
export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = monthsSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Retention must be 1 to 60 months." }, { status: 400 });
  try {
    await setRetentionMonths(serviceRoleClientUntyped(), parsed.data.months);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
