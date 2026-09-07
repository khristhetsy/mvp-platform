import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { captureEmail } from "@/lib/fit/sessions";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email().max(200) });

// Attach an email to the session (available on and after the match screen — including
// the zero-match state, which becomes a nurture lead keyed to the four criteria).
export async function POST(req: NextRequest): Promise<Response> {
  const id = req.cookies.get("fs_session")?.value;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (id) await captureEmail(id, parsed.data.email);
  return NextResponse.json({ ok: true });
}
