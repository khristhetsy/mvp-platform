import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { nextNudgeState } from "@/lib/social/connect-nudge-rules";
import { actingBlock } from "@/lib/admin/acting-central";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["snooze", "dismiss"]) });

/**
 * POST { action }: the founder pressed "Remind me later" (snooze) or closed the
 * "Connect with investors" banner (dismiss). Both hide it for 7 days; a close also
 * counts toward the limit of two. Saved with the founder's own session, so row level
 * security limits it to their own row.
 */
export async function POST(req: Request): Promise<Response> {
  const actingBlocked = await actingBlock();
  if (actingBlocked) return actingBlocked;
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A valid action is required." }, { status: 400 });

  const client = auth.supabase as unknown as SupabaseClient;
  const { data } = await client
    .from("user_preferences")
    .select("social_nudge_dismissals")
    .eq("profile_id", auth.profile.id)
    .maybeSingle();
  const current = (data as { social_nudge_dismissals?: number | null } | null)?.social_nudge_dismissals ?? 0;
  const next = nextNudgeState(parsed.data.action, current);

  const { error } = await client.from("user_preferences").upsert(
    {
      profile_id: auth.profile.id,
      social_nudge_dismissals: next.dismissals,
      social_nudge_snoozed_until: next.snoozedUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
