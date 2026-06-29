import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { replyGmailThread } from "@/lib/integrations/gmail-write";

export const dynamic = "force-dynamic";

const schema = z.object({ body: z.string().min(1).max(50000), html: z.string().max(60000).optional() });

/** POST — reply within a Gmail thread (uses gmail.send). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Message body is required." }, { status: 400 });

  try {
    await replyGmailThread(auth.profile.id, id, parsed.data.body, parsed.data.html ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reply failed." }, { status: 500 });
  }
}
