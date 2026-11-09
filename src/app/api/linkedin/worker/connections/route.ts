import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSender } from "@/lib/linkedin/worker-auth";
import { recordRead } from "@/lib/linkedin/worker-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  campaignId: z.string().uuid(),
  page: z.number().int().min(1).max(100),
  people: z.array(z.object({ slug: z.string().max(200), name: z.string().max(200).nullable().optional() })).max(50).default([]),
  searchUrl: z.string().max(2000).nullable().optional(),
  filtersApplied: z.boolean(),
  failed: z.boolean().optional(),
  warning: z.boolean().optional(),
  detail: z.string().max(300).nullable().optional(),
});

/** POST: the sender reports one page of your own LinkedIn connections. New people are queued for the message. */
export async function POST(request: Request) {
  const auth = await requireSender(request);
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  try {
    return NextResponse.json(await recordRead(auth.account, { ...parsed.data, people: parsed.data.people.map((p) => ({ slug: p.slug, name: p.name ?? null })) }));
  } catch (e) {
    console.error("[linkedin] worker connections failed", e);
    return NextResponse.json({ error: "Could not record the page." }, { status: 500 });
  }
}
