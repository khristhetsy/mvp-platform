import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { draftVariant, ARCHETYPES, type Archetype } from "@/lib/social/composer";

export const dynamic = "force-dynamic";

const schema = z.object({
  brief: z.string().min(10).max(4000),
  archetype: z.enum(ARCHETYPES.map((a) => a.key) as [Archetype, ...Archetype[]]),
  accounts: z.array(z.object({ id: z.string(), displayName: z.string().max(200) })).min(1).max(6),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A brief and at least one account are required." }, { status: 400 });

  // Per-account drafts, rewritten (never copied) for each voice.
  const variants = await Promise.all(
    parsed.data.accounts.map(async (a) => ({
      accountId: a.id,
      body: await draftVariant({ brief: parsed.data.brief, archetype: parsed.data.archetype, accountName: a.displayName }).catch(() => parsed.data.brief),
    })),
  );
  return NextResponse.json({ variants });
}
