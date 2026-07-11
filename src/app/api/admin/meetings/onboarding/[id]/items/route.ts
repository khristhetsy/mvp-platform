import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { toggleOnboardingItem } from "@/lib/meetings/onboarding";

export const dynamic = "force-dynamic";

const schema = z.object({ item_key: z.string().min(2).max(40), done: z.boolean() });

// PATCH — toggle an onboarding item; returns the recomputed conference_ready flag.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    return NextResponse.json(await toggleOnboardingItem(id, parsed.data.item_key, parsed.data.done));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update item." }, { status: 500 });
  }
}
