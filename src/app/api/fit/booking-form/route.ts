import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getFitBookingForm, saveFitBookingForm } from "@/lib/fit/booking-form";

export const dynamic = "force-dynamic";

// Public read: the /fit booking screen renders its fields from this.
export async function GET(): Promise<Response> {
  return NextResponse.json({ form: await getFitBookingForm() });
}

// Admin only: Admin › Fit funnel › Match review booking form.
export async function PUT(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid form." }, { status: 400 });
  try {
    return NextResponse.json({ form: await saveFitBookingForm((body as { form?: unknown }).form ?? body) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
