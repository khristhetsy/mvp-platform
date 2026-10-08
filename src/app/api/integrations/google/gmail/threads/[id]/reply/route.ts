import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { replyGmailThread } from "@/lib/integrations/gmail-write";
import { absolutizeEmailHtml } from "@/lib/email/absolutize-html";
import { scheduleAtFrom, scheduleSend } from "@/lib/scheduled-emails/schedule";

export const dynamic = "force-dynamic";

const schema = z.object({
  body: z.string().min(1).max(50000),
  html: z.string().max(60000).optional(),
  /** Shown on Sales › Scheduled emails when the reply is scheduled. */
  toLabel: z.string().max(500).optional(),
  subject: z.string().max(300).optional(),
});

/** POST — reply within a Gmail thread (uses gmail.send). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const raw: unknown = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Message body is required." }, { status: 400 });

  if (scheduleAtFrom(raw)) {
    // Schedule send: stored now, replied in the same thread at that time (scheduled-emails/runner).
    return scheduleSend({ kind: "gmail_reply", userId: auth.profile.id, raw, params: { id }, toLabel: parsed.data.toLabel ?? "", subject: parsed.data.subject ?? "Reply", contextKey: id });
  }

  try {
    await replyGmailThread(auth.profile.id, id, parsed.data.body, parsed.data.html ? absolutizeEmailHtml(parsed.data.html) : null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reply failed." }, { status: 500 });
  }
}
