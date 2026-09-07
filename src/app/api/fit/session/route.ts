import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, updateSession } from "@/lib/fit/sessions";

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
export async function POST(req: NextRequest): Promise<Response> {
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing) return NextResponse.json({ sessionId: existing });

  const body = await req.json().catch(() => ({}));
  const sourceTag = typeof body?.sourceTag === "string" ? body.sourceTag.slice(0, 120) : null;
  const id = await createSession(sourceTag);
  if (!id) return NextResponse.json({ sessionId: null });

  const res = NextResponse.json({ sessionId: id });
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
