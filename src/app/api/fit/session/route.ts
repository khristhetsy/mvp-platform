import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, updateSession } from "@/lib/fit/sessions";
import { variantFor, forcedVariant } from "@/lib/fit/variant";
import { getFitV2RolloutPct } from "@/lib/settings/platform-settings";
import { recordFunnelEvent } from "@/lib/analytics/funnel";

export const dynamic = "force-dynamic";

const COOKIE = "fs_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function setCookie(res: NextResponse, id: string) {
  res.cookies.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

// Create the session on landing (before any answer). Attribution tag captured once.
// Reuses an existing cookie so a reload doesn't spawn duplicate rows.
// Also returns the A/B arm (v1 control, v2 Match Review), deterministic per session;
// `v` in the body ("1" | "2") forces an arm for previews and QA.
export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const forced = forcedVariant(body?.v);
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing) {
    const variant = forced ?? variantFor(existing, await getFitV2RolloutPct());
    return NextResponse.json({ sessionId: existing, variant });
  }

  const sourceTag = typeof body?.sourceTag === "string" ? body.sourceTag.slice(0, 120) : null;
  const id = await createSession(sourceTag);
  if (!id) return NextResponse.json({ sessionId: null, variant: forced ?? "v1" });

  const pct = await getFitV2RolloutPct();
  const variant = forced ?? variantFor(id, pct);
  // Record the arm at assignment so the split survives a later rollout change.
  // `forced` marks QA/preview sessions so analysis can leave them out.
  await recordFunnelEvent({ sessionId: id, eventName: "fit_variant", properties: { variant, pct, forced: !!forced } });

  const res = NextResponse.json({ sessionId: id, variant });
  setCookie(res, id);
  return res;
}

const patchSchema = z.object({
  step: z.number().int().min(0).max(5).optional(),
  stage: z.string().max(300).optional(),
  raise: z.string().max(300).optional(),
  industry: z.string().max(600).optional(),
  revenue: z.string().max(300).optional(),
});

// Update the session as each question is answered (last_step is the drop-off signal).
export async function PATCH(req: NextRequest): Promise<Response> {
  const id = req.cookies.get(COOKIE)?.value;
  if (!id) return NextResponse.json({ ok: false });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false });
  const { step, ...rest } = parsed.data;
  await updateSession(id, { ...(step !== undefined ? { last_step: step } : {}), ...rest });
  return NextResponse.json({ ok: true });
}
