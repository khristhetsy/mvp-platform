import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api/admin";
import { getOrCreateAccount, previewAudience } from "@/lib/linkedin/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  campaignId: z.string().uuid().nullable().optional(),
  filters: z.object({
    module: z.enum(["investor", "founder"]).optional(),
    stage: z.string().trim().max(80).optional(),
    tag: z.string().trim().max(80).optional(),
    industry: z.string().trim().max(80).optional(),
  }),
});

/** POST { filters }: how many people the campaign would reach, split by invite, message, email first, hand and skipped. */
export async function POST(request: Request) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters." }, { status: 400 });
  try {
    const account = await getOrCreateAccount(auth.profile.id, auth.profile.full_name ?? auth.profile.email ?? "Admin");
    return NextResponse.json(await previewAudience(account, parsed.data.campaignId ?? null, parsed.data.filters));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not build the audience." }, { status: 500 });
  }
}
