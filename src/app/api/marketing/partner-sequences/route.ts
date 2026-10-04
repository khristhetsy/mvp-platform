import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { createPartnerSequence } from "@/lib/marketing/partner-outreach/store";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().trim().min(1).max(200), department: z.string().trim().max(80).nullable().optional() });

// POST /api/marketing/partner-sequences: create a Partner outreach sequence (draft).
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
  try {
    const seq = await createPartnerSequence(parsed.data.name, profile.id, parsed.data.department || null);
    return NextResponse.json(seq, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't create the sequence." }, { status: 500 });
  }
}
