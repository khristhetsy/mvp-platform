import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { packetDocument } from "@/lib/contracts/packet";
import { prospectRespond, SendBlockedError } from "@/lib/contracts/service";

export const dynamic = "force-dynamic";

const schema = z.object({ documentId: z.string().uuid(), action: z.enum(["decline", "changes"]), note: z.string().trim().max(2000) });

/** POST — prospect declines or requests changes. Notifies the sender and closes the signing link. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (parsed.data.action === "changes" && !parsed.data.note) return NextResponse.json({ error: "Tell the sender what you'd like changed." }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const doc = await packetDocument(db, token, parsed.data.documentId);
  if (!doc) return NextResponse.json({ error: "This link is invalid." }, { status: 404 });
  try {
    await prospectRespond(db, doc.id, parsed.data.action, parsed.data.note);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SendBlockedError) return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: "Something went wrong. Please reply to the sender directly." }, { status: 500 });
  }
}
