import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { publishFormDFirms } from "@/lib/formd/publish-to-directory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin only: publishes Form D firms into the founder Investor directory. Either
// an explicit list of firm ids, or every firm matching the Desk search (all: true).
const schema = z
  .object({
    firmIds: z.array(z.string().uuid()).min(1).max(5000).optional(),
    all: z.boolean().optional(),
    q: z.string().max(200).optional(),
  })
  .refine((v) => v.all === true || (v.firmIds?.length ?? 0) > 0, { message: "Select firms or publish all." });

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Select firms or publish all." }, { status: 400 });

  try {
    const result = await publishFormDFirms({ firmIds: parsed.data.all ? undefined : parsed.data.firmIds, q: parsed.data.q });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[formd] publish to directory failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't publish those firms. Try again." }, { status: 500 });
  }
}
