import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listOnboarding, createOnboarding } from "@/lib/meetings/onboarding";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ records: await listOnboarding() });
}

const schema = z.object({ company_name: z.string().min(2).max(200), company_id: z.string().uuid().nullable().optional() });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid company." }, { status: 400 });
  try {
    const id = await createOnboarding(parsed.data.company_name, parsed.data.company_id ?? null, profile.id);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add company." }, { status: 500 });
  }
}
